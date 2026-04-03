export var LANE_WIDTH = 2.5;
export var LANES = [
    -LANE_WIDTH,
    0,
    LANE_WIDTH
]; // X coordinates for left, center, right lanes
export var PLATFORM_DEPTH = 2.0;
export var PLATFORM_HEIGHT = 0.2;
export var PLAYER_START_Z = 2; // Player starts slightly in front of the camera
export var PLAYER_LANE_CHANGE_COOLDOWN = 1.0; // Seconds before another lane change is allowed
export var INITIAL_GAME_SPEED = 7.0; // Starting speed
export var MAX_GAME_SPEED = 50.0; // Maximum speed cap
export var GAME_SPEED_INCREASE_RATE = 0.35; // Speed increases by this amount per second
export var GAME_AREA_LENGTH = 75; // How far ahead obstacles are generated