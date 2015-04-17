/*
 * MMOServer.js
 * A skeleton server for massively multiplayer space battle.
 * Assignment 3 for CS4344, AY2013/14.
 *
 * Usage: 
 *   node MMOServer.js
 */

"use strict";

var LIB_PATH = "./";
require(LIB_PATH + "Config.js");
require(LIB_PATH + "Ship.js");
require(LIB_PATH + "Rocket.js");
require(LIB_PATH + "Player.js");

var NUM_COL = Config.NUM_COL;        // Number of cell column
var NUM_ROW = Config.NUM_ROW;        // Nubmer of cell row

function MMOServer() {
    // private Variables
    var logWriteStream;           // Write stream to log file
    var nextPID = 0;  // PID to assign to next connected player 
    var ships = {};   // Associative array for ships, indexed via player ID
    var rockets = {}; // Associative array for rockets, indexed via timestamp
    var sockets = {}; // Associative array for sockets, indexed via player ID
    var players = {}; // Associative array for players, indexed via socket ID
    var totalPacketSent = 0;        // Keep track of the outgoing packets sent
    var currentThroughput = 0;      // Current sending rate of the server
    var startTime = (new Date ()).getTime();

    var cells = {}; // Associative array of cells, indexed via cell index

    /**
     * private method: getCellId (row, col)
     * take in the 2D coordinate of the cell and return
     * the cell "unique" Id as a string
     */
    var getCellId = function (row, col) {
        return row.toString() + "," + col.toString();
    }

    // Populate the cells associative array with empty cells object
    for (var i = 0; i < NUM_COL; i++) {
        for (var j = 0; j < NUM_ROW; j++) {
            cells[getCellId(i, j)] = {
                rockets: {},
                ships: {}
            };
        }
    }

    /**
     * given the 2d coordinate x,y
     * compute the cell that the point x,y is inside
     */
    var computeCellIndex = function (x, y) {
        var cellCol = parseInt(x / (Config.WIDTH+1) * NUM_COL);
        var cellRow = parseInt(y / (Config.HEIGHT+1) * NUM_ROW);
        return getCellId(cellRow, cellCol);

    }

    /*
     * private method: broadcast(msg)
     *
     * broadcast takes in a JSON structure and send it to
     * all players.
     *
     * e.g., broadcast({type: "abc", x: 30});
     */
    var broadcast = function (msg, debug) {
        var id;
        for (id in sockets) {
            sockets[id].write(JSON.stringify(msg));
            if (!debug) {
                logToFile(msg.type, id);
                totalPacketSent++;
            }
        }
    }

    /*
     * private method: broadcastUnless(msg, id)
     *
     * broadcast takes in a JSON structure and send it to
     * all players, except player id
     *
     * e.g., broadcast({type: "abc", x: 30}, pid);
     */
    var broadcastUnless = function (msg, pid, debug) {
        var id;
        for (id in sockets) {
            if (id != pid) {
                sockets[id].write(JSON.stringify(msg));
                if (!debug) {
                    logToFile(msg.type, id);
                    totalPacketSent ++;
                }
            }
        }
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
    var unicast = function (pid, msg, debug) {
        sockets[pid].write(JSON.stringify(msg));
        if (!debug) {
            totalPacketSent ++;
            logToFile(msg.type, pid);
        }
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
    var logToFile = function (ev, recipient) {
        if (logWriteStream === undefined) {
            console.log('Cannot log to file. Write stream is not initialized.');
        }
        var date = parseInt(((new Date ()).getTime() - startTime) / 1000);
        var msg = [date.toString(), ev, recipient.toString()].join(',') + '\n';

        logWriteStream.write(msg);
    }

    /**
     * private method: canShipBeHit (ship, rocket)
     *
     * test whether the ship may be hit by the rocket.
     * return true if the ship may get hit, false if
     * the ship can not be hit no matter how the ship
     * moves.
     *
     * if error detected, return true as worst case
     *
     * Assumption:
     * ship velocity always smaller than rocket velocity.
     */
    var canShipBeHit = function (ship, rocket) {
        if (ship.VELOCITY >= rocket.VELOCITY) {
            // Ship can always chase the rocket to let them hit
            return true;
        }

        // Potential hit location of the rocket is where the rocket might
        // hit the ship. Ship doesn't need to reach there in time
        var potentialHitLocation = null;

        if ((rocket.dir === "up" && rocket.y >= ship.y) ||
            (rocket.dir === "down" && rocket.y <= ship.y)) {
            potentialHitLocation = {
                x: rocket.x,
                y: ship.y
            };
        } else if ((rocket.dir === "left" && rocket.x >= ship.x) ||
                   (rocket.dir === "right" && rocket.x <= ship.x)) {
            potentialHitLocation = {
                x : ship.x,
                y : rocket.y
            };
        } else {
            // No potentialHitLocation detected. Ship cannot be hit!
            return false;
        }

        // Distance and time required for rocket to reach the potential hit location
        var rocketTravelDist = Math.abs(rocket.x - potentialHitLocation.x) + 
                                Math.abs(rocket.y - potentialHitLocation.y);
        var rocketTravelTime = rocketTravelDist / rocket.getVelocity ();

        // Distance required for ship to reach to potential hit location
        // We calculate the shortest path, since ship can warp around world
        var shipTravelDist;
        if (ship.x == potentialHitLocation.x) {
            var diff = Math.abs(ship.y - potentialHitLocation.y);
            shipTravelDist = Math.min(diff, Config.HEIGHT - diff);
        } else if (ship.y == potentialHitLocation.y) {
            var diff = Math.abs(ship.x - potentialHitLocation.x);
            shipTravelDist = Math.min(diff, Config.WIDTH - diff);
        } else {
            console.log("Something wrong in canShipBeHit function. Return true as worst case");
            return true;
        }
        var shipTravelTime = shipTravelDist / ship.getVelocity ();

        // Ship cannot never be hit when ship cannot reach the potential position in time
        return shipTravelTime < rocketTravelTime;
    }

    /*
     * private method: calculateThroughput
     * update the currentThroughput variable!!
     */
    var calculateThroughput = function () {
        // Update the current throughput variable
        currentThroughput = totalPacketSent / Config.THROUGHPUT_CALCULATION_DURATION * 1000;

        // Reset the count for next interval
        totalPacketSent = 0;

        // console.log ("Current sending rate (packet/s): " + Math.round(currentThroughput));
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
            var cellIndex = computeCellIndex(ship.x, ship.y);
            if (ship.currCellIndex !== cellIndex) {
                // Ship has moved to another cell, transfer ship to the next cell
                if (ship.currCellIndex) {
                    delete cells[ship.currCellIndex].ships[ship.pid];
                }
                cells[cellIndex].ships[ship.pid] = true;
                ship.currCellIndex = cellIndex;
            }
        }

        for (var i in rockets) {
            var rocket = rockets[i];
            rocket.moveOneStep();
            // remove out of bounds rocket
            if (rockets[i].x < 0 || rockets[i].x > Config.WIDTH ||
                rockets[i].y < 0 || rockets[i].y > Config.HEIGHT) {

                // Clean up data structures that deal with interest management 
                delete cells[rocket.currCellIndex].rockets[rocket.rid];
                delete rockets[i];
            } else {
                var cellIndex = computeCellIndex(rocket.x, rocket.y);
                if (rocket.currCellIndex !== cellIndex) {
                    // Rocket has moved to another cell
                    if (rocket.currCellIndex) {
                        delete cells[rocket.currCellIndex].rockets[rocket.rid];
                    }
                    cells[cellIndex].rockets[rocket.rid] = true;
                    rocket.currCellIndex = cellIndex;
                }
            }
        }


        for (var c in cells) {
            // Iterate among rockets and ships within the same cell.
            var cellRockets = cells[c].rockets;
            var cellShips = cells[c].ships;

            for (var i in cellRockets) {
                var deleted = false;
                for (var j in cellShips) {
                    if (rockets[i] !== undefined && rockets[i].from != j && rockets[i].hasHit(ships[j])) {
                        deleted = true;
                        console.log('hit', i, j);
                        if (Config.INTEREST_MANAGEMENT) {
                            // Only send to the player that fire the rocket (for scorekeeping)
                            // and the player that being hit (for damage calculation)
                            var msg = {
                                type: "hit",
                                rocket: i,
                                ship: j
                            };
                            unicast(rockets[i].from, msg, false);
                            unicast(ships[j].pid, msg, false);
                        } else {
                            // Tell everyone there is a hit
                            broadcast({
                                type: "hit", 
                                rocket: i, 
                                ship: j
                            });
                        }
                    }
                }
                if (deleted) {
                    delete cells[rocket.currCellIndex].rockets[rocket.rid];
                    delete rockets[i];
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
            logWriteStream = fs.createWriteStream('log-' + startTime + '.csv', {flags: "w"});
            logWriteStream.write('Time,Event,Recipient\n');
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

                    delete ships[pid];
                    delete players[conn.id];
                    broadcastUnless({
                        type: "delete", 
                        id: pid}, pid, false)
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
                            var s = new Ship();
                            s.init(x, y, dir, pid);
                            s.currCellIndex = computeCellIndex (x, y);
                            ships[pid] = s;
                            broadcastUnless({
                                    type: "new", 
                                    id: pid, 
                                    x: x,
                                    y: y,
                                    dir: dir
                                }, pid, false);
                            unicast(pid, {
                                    type: "join",
                                    id: pid,
                                    x: x,
                                    y: y,
                                    dir: dir
                                }, false);
                            
                            // Tell this new guy who else is in the game.
                            for (var i in ships) {
                                if (i != pid) {
                                    if (ships[i] !== undefined) {
                                        unicast(pid, {
                                                type: "new",
                                                id: i, 
                                                x: ships[i].x, 
                                                y: ships[i].y, 
                                                dir: ships[i].dir
                                            }, false);   
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
                                    type: "turn",
                                    id: pid,
                                    x: message.x, 
                                    y: message.y, 
                                    dir: message.dir
                                }, pid, false);
                            break;

                        case "fire":
                            // A player has asked to fire a rocket.  Create
                            // a rocket, and tell everyone (including the player, 
                            // so that it knows the rocket ID).
                            var pid = players[conn.id].pid;
                            var r = new Rocket();
                            var rocketId = (new Date ()).getTime();
                            r.init(message.x, message.y, message.dir, pid, rocketId);
                            r.currCellIndex = computeCellIndex (message.x, message.y);
                            var rocketId = new Date().getTime();
                            rockets[rocketId] = r;

                            if (Config.INTEREST_MANAGEMENT) {
                                for (var i in ships) {
                                    var sendNormal = false;
                                    var sendDebug = false;

                                    // Only send message to ship that fired the rocket
                                    // or that are likely to be hit
                                    if (i == pid || canShipBeHit (ships[i], rockets[rocketId])) {
                                        // If that ship can be hit, tell it
                                        sendNormal = true;
                                    } else if (currentThroughput < Config.MAX_ESTIMATE_SEND_RATE_PER_USER * Object.keys(players).length) {
                                        // Send if the bandwidth is underused
                                        sendNormal = true;
                                    } else if (Config.DEBUG_MODE) {
                                        // If that ship cannot be hit, server can skip telling them
                                        // Send it here for debug purposes
                                        sendDebug = true;
                                    }

                                    if (sendNormal) {
                                        var msg = {
                                            type: "fire",
                                            ship: pid,
                                            rocket: rocketId,
                                            x: message.x,
                                            y: message.y,
                                            dir: message.dir,
                                        };
                                        unicast(i, msg, false);
                                    }

                                    if (sendDebug) {
                                        var msg = {
                                            type: "fire-not-interested",
                                            ship: pid,
                                            rocket: rocketId,
                                            x: message.x,
                                            y: message.y,
                                            dir: message.dir,
                                        };
                                        unicast(i, msg, true);
                                    }
                                }
                            } else {
                                // Broadcast fire event to all
                                broadcast({
                                    type:"fire",
                                    ship: pid,
                                    rocket: rocketId,
                                    x: message.x,
                                    y: message.y,
                                    dir: message.dir
                                });
                            }

                            break;
                            
                        default:
                            console.log("Unhandled " + message.type);
                    }
                }); // conn.on("data"
            }); // socket.on("connection"

            // cal the game loop
            setInterval(function() {gameLoop();}, 1000/Config.FRAME_RATE);
            setInterval(function() {calculateThroughput();}, Config.THROUGHPUT_CALCULATION_DURATION);

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
