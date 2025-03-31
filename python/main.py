from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Callable, Dict, Any, Optional
import json
import uuid
import asyncio
from config import ALLOWED_ORIGINS, GAME_TIMEOUT

app = FastAPI(
    title="Tic Tac Toe WebSocket Game",
    description="A real-time multiplayer Tic Tac Toe game using WebSocket",
    version="1.0.0"
)

# Add info endpoint
@app.get("/")
async def root():
    return {
        "name": "Tic Tac Toe WebSocket Game",
        "version": "1.0.0",
        "creators": [
            {
                "name": "HarshAhalpara-001",
                "github": "https://github.com/HarshAhalpara-001"
            }
        ],
        "description": "A real-time multiplayer Tic Tac Toe game built with FastAPI and React"
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.players: Dict[str, str] = {}
        self.gamesessions: Dict[str, Dict] = {}
        self.handlers: Dict[str, Callable] = {}

    def register_handler(self, message_type: str):
        def decorator(handler: Callable):
            self.handlers[message_type] = handler
            return handler
        return decorator

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        user_id = str(uuid.uuid4())
        self.active_connections[user_id] = websocket
        return user_id

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].close()
            except Exception:
                pass
            del self.active_connections[user_id]
        if user_id in self.players:
            del self.players[user_id]
        for session_id in list(self.gamesessions.keys()):
            if user_id in [self.gamesessions[session_id]['player_a'], self.gamesessions[session_id]['player_b']]:
                del self.gamesessions[session_id]

    async def send_personal_message(self, user_id: str, message: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
            except (RuntimeError, WebSocketDisconnect):
                self.disconnect(user_id)

    async def broadcast_player_list(self):
        self.players = {
            uid: username for uid, username in self.players.items()
            if uid in self.active_connections
        }
        player_list = [
            {"user_id": uid, "username": username} 
            for uid, username in self.players.items()
        ]
        await self.broadcast(json.dumps({
            "type": "player_list",
            "players": player_list
        }))

    async def broadcast(self, message: str, exclude_user: Optional[str] = None):
        closed_connections = []
        for uid, connection in self.active_connections.items():
            if uid != exclude_user:
                try:
                    await connection.send_text(message)
                except (RuntimeError, WebSocketDisconnect):
                    closed_connections.append(uid)
        for uid in closed_connections:
            self.disconnect(uid)

    async def handle_message(self, user_id: str, message: str):
        try:
            data = json.loads(message)
            if handler := self.handlers.get(data["type"]):
                await handler(self, user_id, data)
        except (json.JSONDecodeError, KeyError) as e:
            error_msg = "Invalid message format" if isinstance(e, json.JSONDecodeError) else "Missing 'type' field"
            await self.send_personal_message(user_id, json.dumps({
                "type": "error",
                "message": error_msg
            }))

manager = ConnectionManager()

async def handle_username(manager: ConnectionManager, user_id: str, data: Dict[str, Any]):
    username = data.get("username")
    if username:
        manager.players[user_id] = username
        await manager.send_personal_message(user_id, json.dumps({
            "type": "welcome",
            "your_id": user_id
        }))
        await manager.broadcast_player_list()

async def handle_send_invite(manager: ConnectionManager, user_id: str, data: Dict[str, Any]):
    invite_id = data.get("invite_id")
    if not invite_id:
        await manager.send_personal_message(
            user_id,
            json.dumps({"type": "error", "message": "Missing invite_id"})
        )
        return
    
    if invite_id in manager.active_connections:
        await manager.send_personal_message(
            invite_id,
            json.dumps({
                "type": "invitation",
                "from_user_id": user_id,
                "from_username": manager.players.get(user_id, "Unknown")
            })
        )
    else:
        await manager.send_personal_message(
            user_id,
            json.dumps({
                "type": "error",
                "message": f"User {invite_id} is not currently online"
            })
        )

async def handle_invitation_response(manager: ConnectionManager, user_id: str, data: Dict[str, Any]):
    accepted = data.get("accepted")
    from_user_id = data.get("from_user_id")
    
    if not accepted:
        if from_user_id in manager.active_connections:
            await manager.send_personal_message(
                from_user_id,
                json.dumps({
                    "type": "invitation_response",
                    "accepted": False,
                    "from_user_id": user_id
                })
            )
        return
    
    if from_user_id not in manager.active_connections or user_id not in manager.active_connections:
        await manager.send_personal_message(
            user_id,
            json.dumps({"type": "error", "message": "Player is no longer available"})
        )
        return
    
    session_id = str(uuid.uuid4())
    manager.gamesessions[session_id] = {
        "player_a": from_user_id,
        "player_b": user_id,
        "board": [None]*9,
        "current_turn": from_user_id,
        "message_queue": asyncio.Queue()
    }
    
    asyncio.create_task(run_game_session(session_id))

async def check_winner(board):
    win_patterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ]
    for pattern in win_patterns:
        a, b, c = pattern
        if board[a] and board[a] == board[b] and board[a] == board[c]:
            return board[a]
    return None if None in board else "Draw"

async def run_game_session(session_id: str):
    game = manager.gamesessions.get(session_id)
    if not game:
        return
    
    while True:
        current_player = game["current_turn"]
        opponent = game["player_b"] if current_player == game["player_a"] else game["player_a"]
        
        winner = await check_winner(game["board"])
        if winner:
            await manager.send_personal_message(
                current_player,
                json.dumps({
                    "type": "game_over",
                    "result": "win" if winner != "Draw" else "draw",
                    "board": game["board"],
                    "your_symbol": "X" if current_player == game["player_a"] else "O"
                })
            )
            await manager.send_personal_message(
                opponent,
                json.dumps({
                    "type": "game_over",
                    "result": "loss" if winner != "Draw" else "draw",
                    "board": game["board"],
                    "your_symbol": "O" if current_player == game["player_a"] else "X"
                })
            )
            await asyncio.sleep(2)
            break

        await manager.send_personal_message(
            current_player,
            json.dumps({
                "type": "your_turn",
                "session_id": session_id,
                "board": game["board"],
                "your_symbol": "X" if current_player == game["player_a"] else "O"
            })
        )
        
        await manager.send_personal_message(
            opponent,
            json.dumps({
                "type": "wait_for_turn",
                "session_id": session_id,
                "board": game["board"],
                "your_symbol": "O" if current_player == game["player_a"] else "X"
            })
        )
        
        try:
            move_data = await asyncio.wait_for(game["message_queue"].get(), timeout=GAME_TIMEOUT)
            position = move_data.get("position")
            
            if 0 <= position < 9 and game["board"][position] is None:
                game["board"][position] = 'X' if current_player == game["player_a"] else 'O'
                game["current_turn"] = opponent
        except asyncio.TimeoutError:
            await manager.send_personal_message(
                current_player,
                json.dumps({"type": "game_over", "result": "timeout"})
            )
            await manager.send_personal_message(
                opponent,
                json.dumps({"type": "game_over", "result": "timeout"})
            )
            await asyncio.sleep(2)
            break
    
    if session_id in manager.gamesessions:
        del manager.gamesessions[session_id]
        await manager.send_personal_message(
            current_player,
            json.dumps({
                "type": "game_ended",
                "message": "Game ended. You can start a new game."
            })
        )
        await manager.send_personal_message(
            opponent,
            json.dumps({
                "type": "game_ended",
                "message": "Game ended. You can start a new game."
            })
        )

async def handle_game_move(manager: ConnectionManager, user_id: str, data: Dict[str, Any]):
    session_id = data.get("session_id")
    position = data.get("position")
    
    if session_id not in manager.gamesessions:
        await manager.send_personal_message(
            user_id,
            json.dumps({"type": "error", "message": "Invalid game session"})
        )
        return
    
    game = manager.gamesessions[session_id]
    if user_id == game["current_turn"]:
        await game["message_queue"].put({"player_id": user_id, "position": position})
    else:
        await manager.send_personal_message(
            user_id,
            json.dumps({"type": "error", "message": "Not your turn"})
        )

async def handle_leave(manager: ConnectionManager, user_id: str, data: Dict[str, Any]):
    manager.disconnect(user_id)
    await manager.broadcast_player_list()

manager.register_handler("username")(handle_username)
manager.register_handler("send_invite")(handle_send_invite)
manager.register_handler("invitation_response")(handle_invitation_response)
manager.register_handler("game_move")(handle_game_move)
manager.register_handler("leave")(handle_leave)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            await manager.handle_message(user_id, message)
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_player_list()
    except Exception as e:
        print(f"Unexpected error: {e}")
        manager.disconnect(user_id)
        await manager.broadcast_player_list()