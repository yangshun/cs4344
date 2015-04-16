/*=====================================================
  Declared as literal object (All variables are static)	  
  =====================================================*/
var Config = {
	HEIGHT : 700,				// height of game window
	WIDTH : 1000,				// width of game window
	PORT : 4344,				// port of game
	FRAME_RATE : 40,			// frame rate 
	SERVER_NAME : "localhost",	// server name of game
	//SERVER_NAME : "172.28.176.122"	// server name of game

	THROUGHPUT_CALCULATION_DURATION : 2000,
	MAX_ESTIMATE_SEND_RATE_PER_USER : 20,		// Estimate the maximum sending rate per user
	DEBUG_MODE : true			// Enable/Disable rendering skipped events
}


// For node.js require
global.Config = Config;

// vim:ts=4
