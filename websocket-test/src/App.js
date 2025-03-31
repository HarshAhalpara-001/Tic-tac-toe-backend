import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "ws://localhost:8000";

function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-700 py-3">
      <div className="container mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Created by{" "}
        <a
          href="https://github.com/HarshAhalpara-001"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-light dark:text-primary-dark hover:underline"
        >
          HarshAhalpara-001
        </a>
      </div>
    </footer>
  );
}

function App() {
  const [username, setUsername] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeInvitation, setActiveInvitation] = useState(null);
  const [notification, setNotification] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    return savedTheme === "dark" || (!savedTheme && prefersDark);
  });
  const socketRef = useRef(null);

  const connectWebSocket = () => {
    if (!username.trim()) return;

    const ws = new WebSocket(`${BACKEND_URL}/ws`);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(
        JSON.stringify({
          type: "username",
          username: username.trim(),
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received:", data);

      if (data.type === "player_list") {
        setPlayers(data.players);
      }

      if (data.type === "welcome") {
        setCurrentUser({
          user_id: data.your_id,
          username: username.trim(),
        });
      }

      if (data.type === "invitation") {
        setActiveInvitation({
          from_user_id: data.from_user_id,
          from_username: data.from_username,
        });
        setNotification({
          type: "info",
          message: `${data.from_username} has invited you to play!`,
        });
      }

      if (data.type === "your_turn") {
        setCurrentGame((prev) => ({
          ...prev,
          sessionId: data.session_id,
          board: data.board,
          yourSymbol: data.your_symbol,
          isYourTurn: true,
          opponent: prev?.opponent || {
            user_id: activeInvitation?.from_user_id,
            username: activeInvitation?.from_username || "Opponent",
          },
        }));
      }

      if (data.type === "wait_for_turn") {
        setCurrentGame((prev) => ({
          ...prev,
          sessionId: data.session_id,
          board: data.board,
          yourSymbol: data.your_symbol,
          isYourTurn: false,
          opponent: prev?.opponent || {
            user_id: activeInvitation?.from_user_id,
            username: activeInvitation?.from_username || "Opponent",
          },
        }));
      }

      if (data.type === "game_over") {
        setCurrentGame((prev) => ({
          ...prev,
          board: data.board,
          gameResult: data.result,
          isYourTurn: false,
        }));
        setNotification({
          type: "info",
          message:
            data.result === "loss"
              ? "You won! 🎉"
              : data.result === "win"
              ? "You lost! 😔"
              : data.result === "draw"
              ? "Game ended in a draw! 🤝"
              : "Game timed out! ⏰",
        });
      }

      if (data.type === "game_ended") {
        setTimeout(() => {
          setCurrentGame(null);
          setActiveInvitation(null);
          setNotification({
            type: "info",
            message: data.message,
          });
        }, 2000);
      }

      if (data.type === "error") {
        setNotification({
          type: "error",
          message: data.message,
        });
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setCurrentUser(null);
      setPlayers([]);
      setActiveInvitation(null);
      setCurrentGame(null);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setNotification({
        type: "error",
        message: "Connection error occurred",
      });
    };
  };

  const sendInvite = (inviteId) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "send_invite",
          invite_id: inviteId,
        })
      );
    }
  };

  const respondToInvitation = (accept) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && activeInvitation) {
      socketRef.current.send(
        JSON.stringify({
          type: "invitation_response",
          from_user_id: activeInvitation.from_user_id,
          accepted: accept,
        })
      );

      if (accept) {
        setCurrentGame({
          sessionId: null,
          board: Array(9).fill(null),
          yourSymbol: "O",
          isYourTurn: false,
          opponent: {
            user_id: activeInvitation.from_user_id,
            username: activeInvitation.from_username,
          },
        });
      }

      setActiveInvitation(null);
    }
  };

  const makeMove = (position) => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN &&
      currentGame?.isYourTurn &&
      !currentGame.board[position] &&
      !currentGame.gameResult
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: "game_move",
          session_id: currentGame.sessionId,
          position: position,
        })
      );
    }
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    // Initialize theme based on system preference and saved theme
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const savedTheme = localStorage.getItem("theme");
    const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark);

    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (!localStorage.getItem("theme")) {
        setIsDarkMode(e.matches);
        if (e.matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  if (currentGame) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-background-light dark:bg-background-dark p-6 pb-16"
      >
        <div className="absolute top-4 right-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className="bg-white dark:bg-gray-800 text-primary-light dark:text-primary-dark px-4 py-2 rounded-lg transition-colors"
          >
            {isDarkMode ? "🌞" : "🌙"}
          </motion.button>
        </div>
        <TicTacToeBoard
          game={currentGame}
          onMove={makeMove}
          onQuit={disconnectWebSocket}
          isDarkMode={isDarkMode}
        />
        <Footer />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6 pb-16">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
              notification.type === "error"
                ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100"
                : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {!isConnected ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto mt-20 bg-surface-light dark:bg-surface-dark rounded-lg shadow-lg p-8"
        >
          <h2 className="text-3xl font-bold text-center mb-8 text-text-light dark:text-text-dark">
            Enter Your Username
          </h2>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg mb-6 focus:border-primary-light dark:focus:border-primary-dark focus:outline-none transition-colors bg-white dark:bg-gray-800 text-text-light dark:text-text-dark"
            onKeyPress={(e) => e.key === "Enter" && connectWebSocket()}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={connectWebSocket}
            className="w-full bg-primary-light dark:bg-primary-dark text-white py-3 rounded-lg font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
          >
            Connect
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-4xl mx-auto bg-surface-light dark:bg-surface-dark rounded-lg shadow-lg overflow-hidden"
        >
          <div className="bg-primary-light dark:bg-primary-dark p-6 flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-white">
              Welcome, {currentUser?.username}!
            </h2>
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className="bg-white dark:bg-gray-800 text-primary-light dark:text-primary-dark px-4 py-2 rounded-lg transition-colors"
              >
                {isDarkMode ? "🌞" : "🌙"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={disconnectWebSocket}
                className="bg-danger-light dark:bg-danger-dark hover:bg-red-600 dark:hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Disconnect
              </motion.button>
            </div>
          </div>

          <div className="p-6">
            {activeInvitation && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg"
              >
                <p className="mb-3 text-lg text-yellow-800 dark:text-yellow-100">
                  {activeInvitation.from_username} invited you to play!
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => respondToInvitation(true)}
                    className="bg-secondary-light dark:bg-secondary-dark hover:bg-green-600 dark:hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Accept
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => respondToInvitation(false)}
                    className="bg-danger-light dark:bg-danger-dark hover:bg-red-600 dark:hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Decline
                  </motion.button>
                </div>
              </motion.div>
            )}

            <h3 className="text-xl font-medium mb-4 text-text-light dark:text-text-dark">
              Online Players ({players.length})
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {players.length === 0 ? (
                <p className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No other players connected
                </p>
              ) : (
                <ul>
                  {players
                    .filter((player) => player.user_id !== currentUser?.user_id)
                    .map((player) => (
                      <motion.li
                        key={player.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div>
                          <span className="font-medium text-text-light dark:text-text-dark">
                            {player.username}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                            ID: {player.user_id.slice(0, 8)}...
                          </span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => sendInvite(player.user_id)}
                          className="bg-secondary-light dark:bg-secondary-dark hover:bg-green-600 dark:hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Invite
                        </motion.button>
                      </motion.li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      )}
      <Footer />
    </div>
  );
}

function TicTacToeBoard({ game, onMove, onQuit, isDarkMode }) {
  const handleCellClick = (index) => {
    if (game.isYourTurn && !game.board[index] && !game.gameResult) {
      onMove(index);
    }
  };

  const renderCell = (index) => {
    const cellValue = game.board[index];
    let cellClass =
      "w-24 h-24 flex items-center justify-center text-5xl font-bold rounded-xl transition-all duration-300 shadow-lg backdrop-blur-sm";

    if (cellValue === "X") {
      cellClass +=
        " bg-primary-light/10 dark:bg-primary-dark/20 text-primary-light dark:text-primary-dark border-2 border-primary-light dark:border-primary-dark";
    } else if (cellValue === "O") {
      cellClass +=
        " bg-danger-light/10 dark:bg-danger-dark/20 text-danger-light dark:text-danger-dark border-2 border-danger-light dark:border-danger-dark";
    } else if (game.isYourTurn && !game.gameResult) {
      cellClass +=
        " cursor-pointer bg-surface-light/50 dark:bg-surface-dark/50 hover:bg-primary-light/5 dark:hover:bg-primary-dark/10 border-2 border-gray-200 dark:border-gray-700";
    } else {
      cellClass +=
        " bg-surface-light/50 dark:bg-surface-dark/50 border-2 border-gray-200 dark:border-gray-700";
    }

    return (
      <motion.div
        key={index}
        className={cellClass}
        onClick={() => handleCellClick(index)}
        whileHover={
          game.isYourTurn && !game.board[index] && !game.gameResult
            ? { scale: 1.05, rotate: 1 }
            : {}
        }
        whileTap={{ scale: 0.95 }}
      >
        {cellValue}
      </motion.div>
    );
  };

  const getGameResult = () => {
    if (!game.gameResult) return null;

    switch (game.gameResult) {
      case "win":
        return {
          text: "You lost! 😔",
          class: "text-danger-light dark:text-danger-dark",
          animation: { scale: 1 },
        };
      case "loss":
        return {
          text: "You won! 🎉",
          class: "text-secondary-light dark:text-secondary-dark",
          animation: {
            scale: [1, 1.1, 1],
            rotate: [0, 3, 0],
            transition: { duration: 4, repeat: Infinity },
          },
        };
      case "draw":
        return {
          text: "Game ended in a draw! 🤝",
          class: "text-accent-light dark:text-accent-dark",
          animation: { scale: 1 },
        };
      default:
        return {
          text: "Game timed out! ⏰",
          class: "text-text-light dark:text-text-dark",
          animation: { scale: 1 },
        };
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-screen"
    >
      <div className="mb-8 text-center">
        <motion.h2
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl font-bold mb-6 text-text-light dark:text-text-dark bg-clip-text"
        >
          Tic Tac Toe
        </motion.h2>
        {game.gameResult ? (
          <motion.p
            initial={{ scale: 0.8, opacity: 0 }}
            animate={getGameResult().animation}
            className={`text-3xl font-bold ${getGameResult().class}`}
          >
            {getGameResult().text}
          </motion.p>
        ) : (
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-xl"
          >
            {game.isYourTurn ? (
              <span className="text-primary-light dark:text-primary-dark font-semibold">
                Your turn ({game.yourSymbol})
              </span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">
                Waiting for opponent...
              </span>
            )}
          </motion.p>
        )}
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative p-8 rounded-2xl shadow-game dark:shadow-game-dark bg-gradient-to-br from-surface-light/90 to-surface-light dark:from-surface-dark/90 dark:to-surface-dark backdrop-blur-lg"
      >
        <div className="grid grid-cols-3 gap-4">
          {Array(9)
            .fill()
            .map((_, index) => renderCell(index))}
        </div>
      </motion.div>

      <div className="mt-12 text-center">
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
          Playing against:{" "}
          <span className="font-semibold text-text-light dark:text-text-dark">
            {game.opponent?.username || "Opponent"}
          </span>
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onQuit}
          className="px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-danger-light to-danger-light/80 dark:from-danger-dark dark:to-danger-dark/80 hover:from-danger-light/90 hover:to-danger-light/70 dark:hover:from-danger-dark/90 dark:hover:to-danger-dark/70 shadow-lg transition-all duration-300"
        >
          {game.gameResult ? "New Game" : "Quit Game"}
        </motion.button>
      </div>
    </motion.div>
  );
}

export default App;
