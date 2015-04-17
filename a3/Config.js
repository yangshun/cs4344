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

	NUM_ROW: 4,
	NUM_COL: 4,
	INTEREST_MANAGEMENT : true,				// 	Turn interest management on/off. 
											//	`hit` and `fire` events are optimized of set to `true`.

	DEBUG_MODE : true,						// 	Enable/disable rendering rockets that are not of interest to current ship 
											//	(only works when INTEREST_MANAGEMENT is `true`)
											//	Rockets are rendered as magenta when set to `true`.

	THROUGHPUT_CALCULATION_DURATION : 2000,	//	Interval range to collect network traffic

	MAX_ESTIMATE_SEND_RATE_PER_USER : 0,	// 	Estimate the maximum sending rate per user. 
											//	Set to non-zero to enable the feature where extra messages
											//	can be sent where network is not congested.
	LOG_EVENTS: false
}


// For node.js require
global.Config = Config;

// vim:ts=4
