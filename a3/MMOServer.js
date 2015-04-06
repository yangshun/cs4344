/*
 * MMOServer.js
 * A skeleton server for massively multiplayer space battle.
 * Assignment 3 for CS4344, AY2013/14.
 *
 * Usage: 
 *   node MMOServer.js
 */

"use strict";

var LOG_FILE = "./log.txt";                           // File name to log the traffic

var LIB_PATH = "./";
require(LIB_PATH + "Config.js");
require(LIB_PATH + "Ship.js");
require(LIB_PATH + "Rocket.js");
require(LIB_PATH + "Player.js");

var NUM_COL = 4;        // Number of cell column
var NUM_ROW = 4;        // Nubmer of cell row

function MMOServer() {
    // private Variables
    var logWriteStream;           // Write stream to log file
    var nextPID = 0;  // PID to assign to next connected player 
    var ships = {};   // Associative array for ships, indexed via player ID
    var rockets = {}; // Associative array for rockets, indexed via timestamp
    var sockets = {}; // Associative array for sockets, indexed via player ID
    var players = {}; // Associative array for players, indexed via socket ID

    var cells = {};
    var rocketCells = {};
    var shipCells = {};

    /**
     * private method: getCellId (row, col)
     * take in the 2D coordinate of the cell and return
     * the cell "unique" Id as a string
     */
    var getCellId = function (row, col) {
        return row.toString() + "," + col.toString();
    }

    // Populate the cells array with empty cell object
    for (var i = 0; i < NUM_COL; i++) {
        for (var j = 0; j < NUM_ROW; j++) {
            cells[getCellId(i, j)] = {
                rockets: {},
                ships: {}
            };
        }
    }

    /*
     * private method: broadcast(msg)
     *
     * broadcast takes in a JSON structure and send it to
     * all players.
     *
     * e.g., broadcast({type: "abc", x: 30});
     */
    var broadcast = function (msg) {
        var id;
        for (id in sockets) {
            sockets[id].write(JSON.stringify(msg));
        }

        logToFile ("Server to All:\n" + JSON.stringify(msg));
    }

    /*
     * private method: broadcastUnless(msg, id)
     *
     * broadcast takes in a JSON structure and send it to
     * all players, except player id
     *
     * e.g., broadcast({type: "abc", x: 30}, pid);
     */
    var broadcastUnless = function (msg, pid) {
        var id;
        for (id in sockets) {
            if (id != pid)
                sockets[id].write(JSON.stringify(msg));
        }

        logToFile ("Server to All except " + pid + ":\n" + JSON.stringify(msg));
    }

    /*
     * private method: unicast(pid, msg)
     *
     * unicast takes in a pid and a JSON structure 
     * and send the message through the socket associated
     * with the pid given.
     *
     * e.g., unicast(pid, {type: "abc", x: 30});
     */
    var unicast = function (pid, msg) {
        sockets[pid].write(JSON.stringify(msg));

        logToFile ("Server to " + pid + ":\n" + JSON.stringify(msg));
    }

    /*
     * private method: newPlayer()
     *
     * Called when a new connection is detected.  
     * Create and init the new player.
     */
    var newPlayer = function (conn) {
        nextPID ++;
        // Create player object and insert into players with key = conn.id
        players[conn.id] = new Player();
        players[conn.id].pid = nextPID;
        sockets[nextPID] = conn;
    }

    /**
     * private method: logToFile (fd, msg)
     *
     * push the msg into the write stream to log file
     */
    var logToFile = function (msg) {
        if (logWriteStream == undefined) {
            console.log ("Cannot log to file. Write stream is not initialized.");
        }

        logWriteStream.write ("Time: " + (new Date ()).getTime () + "\n");
        logWriteStream.write (msg + "\n");
        logWriteStream.write ("\n");
    }

    /*
     * private method: gameLoop()
     *
     * The main game loop.  Called every interval at a
     * period roughly corresponding to the frame rate 
     * of the game
     */
    var gameLoop = function () {
        for (var i in ships) {
            var ship = ships[i];
            ship.moveOneStep();
            var cellRow = parseInt(ship.y / (Config.HEIGHT+1) * NUM_ROW);
            var cellCol = parseInt(ship.x / (Config.WIDTH+1) * NUM_COL);
            var cellIndex = getCellId(cellRow, cellCol);
            if (ship.currCellIndex !== cellIndex) {
                // Ship has moved to another cell, transfer ship to the next cell
                if (ship.currCellIndex) {
                    delete cells[ship.currCellIndex].ships[ship.pid];
                }
                cells[cellIndex].ships[ship.pid] = true;
                
                shipCells[ship.pid] = {};
                shipCells[ship.pid][cellIndex] = true;

                ship.currCellIndex = cellIndex;
            }

        }
        for (var i in rockets) {
            rockets[i].moveOneStep();
            // remove out of bounds rocket
            if (rockets[i].x < 0 || rockets[i].x > Config.WIDTH ||
                rockets[i].y < 0 || rockets[i].y > Config.HEIGHT) {
                rockets[i] = null;
                delete rockets[i];
            } else {
                // For each ship, checks if this rocket has hit the ship
                // A rocket cannot hit its own ship.
                for (var j in ships) {
                    if (rockets[i] != undefined && rockets[i].from != j) {
                        if (rockets[i].hasHit(ships[j])) {
                            // tell everyone there is a hit
                            broadcast({type:"hit", rocket:i, ship:j})
                            delete rockets[i];
                        }
                    } 
                }
            }
        }
    }

    /*
     * priviledge method: start()
     *
     * Called when the server starts running.  Open the
     * socket and listen for connections.  Also initialize
     * callbacks for socket.
     */
    this.start = function () {
        // Create log file on start for logging networ traffic
        try {
            var fs = require ("fs");
            logWriteStream = fs.createWriteStream (LOG_FILE, {flags: "w"});
        } catch (e) {
            console.log ("Cannot create log write stream. Make sure fs package is installed.");
            return;
        }

        try {
            var express = require('express');
            var http = require('http');
            var sockjs = require('sockjs');
            var sock = sockjs.createServer();

            // Upon connection established from a client socket
            sock.on('connection', function (conn) {
                newPlayer(conn);

                // When the client closes the connection to the 
                // server/closes the window
                conn.on('close', function () {
                    var pid = players[conn.id].pid;
                    logToFile (pid + " to Server:\nclose connection");

                    delete ships[pid];
                    delete players[conn.id];
                    broadcastUnless({
                        type: "delete", 
                        id: pid}, pid)
                });

                // When the client send something to the server.
                conn.on('data', function (data) {
                    var message = JSON.parse(data)
                    var p = players[conn.id];
                    if (p === undefined) {
                        // we received data from a connection with
                        // no corresponding player.  don't do anything.
                        console.log("player at " + conn.id + " is invalid."); 
                        return;
                    }

                    // Log incoming data package
                    var pid = players[conn.id].pid;
                    logToFile (pid + " to Server: \n" + JSON.stringify(message));

                    // Logic to deal with each type of incoming data package
                    switch (message.type) {
                        case "join":
                            // A client has requested to join. 
                            // Initialize a ship at random position
                            // and tell everyone.
                            var pid = players[conn.id].pid;

                            var x = Math.floor(Math.random()*Config.WIDTH);
                            var y = Math.floor(Math.random()*Config.HEIGHT);
                            var dir;
                            var dice = Math.random();
                            // pick a dir with equal probability
                            if (dice < 0.25) {
                                dir = "right";
                            } else if (dice < 0.5) {
                                dir = "left";
                            } else if (dice < 0.75) {
                                dir = "up";
                            } else {
                                dir = "down";
                            }
                            ships[pid] = new Ship();
                            ships[pid].init(x, y, dir, pid);
                            broadcastUnless({
                                type: "new", 
                                id: pid, 
                                x: x,
                                y: y,
                                dir: dir}, pid)
                            unicast(pid, {
                                type: "join",
                                id: pid,
                                x: x,
                                y: y,
                                dir: dir});   
                            
                            // Tell this new guy who else is in the game.
                            for (var i in ships) {
                                if (i != pid) {
                                    if (ships[i] !== undefined) {
                                        unicast(pid, {
                                            type:"new",
                                            id: i, 
                                            x: ships[i].x, 
                                            y: ships[i].y, 
                                            dir: ships[i].dir});   
                                    }
                                }
                            }
                            break;

                        case "turn":
                            // A player has turned.  Tell everyone else.
                            var pid = players[conn.id].pid;
                            ships[pid].jumpTo(message.x, message.y);
                            ships[pid].turn(message.dir);
                            broadcastUnless({
                                type:"turn",
                                id: pid,
                                x: message.x, 
                                y: message.y, 
                                dir: message.dir
                            }, pid);
                            break;

                        case "fire":
                            // A player has asked to fire a rocket.  Create
                            // a rocket, and tell everyone (including the player, 
                            // so that it knows the rocket ID).
                            var pid = players[conn.id].pid;
                            var r = new Rocket();
                            r.init(message.x, message.y, message.dir, pid);
                            var rocketId = new Date().getTime();
                            rockets[rocketId] = r;
                            broadcast({
                                type:"fire",
                                ship: pid,
                                rocket: rocketId,
                                x: message.x,
                                y: message.y,
                                dir: message.dir
                            });
                            break;
                            
                        default:
                            console.log("Unhandled " + message.type);
                    }
                }); // conn.on("data"
            }); // socket.on("connection"

            // cal the game loop
            setInterval(function() {gameLoop();}, 1000/Config.FRAME_RATE); 

            // Standard code to start the server and listen
            // for connection
            var app = express();
            var httpServer = http.createServer(app);
            sock.installHandlers(httpServer, {prefix:'/space'});
            httpServer.listen(Config.PORT, Config.SERVER_NAME);
            app.use(express.static(__dirname));
            console.log("Server running on http://" + Config.SERVER_NAME + 
                    ":" + Config.PORT + "\n")
            console.log("Visit http://" + Config.SERVER_NAME + ":" + Config.PORT + "/index.html in your browser to start the game")
        } catch (e) {
            console.log("Cannot listen to " + Config.PORT);
            console.log("Error: " + e);
        }
    }
}

// This will auto run after this script is loaded
var server = new MMOServer();
server.start();

// vim:ts=4:sw=4:expandtab
