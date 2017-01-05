'use strict'

var DEBUG = false;
var SOLO_BACKGROUND = false;
var debugLayer;

var filter;
//emitter
var emitterContainer, elapsed, now, topLevelParticles, midLevelParticles, backLevelParticles,
  topEmitterContainer, midEmitterContainer, backEmitterContainer, particlesContainer, lightningContainer;
var sunEmitters = [];
var updaters = [];
var windEmitters = [];
//debugs
var DEBUG_ACCEL_LIMIT = 100;
var SLIDE_PAD = 40;
var WEATHER_TYPES = [createRain, createWind, createSunLight, createClouds];
var currentWeatherType = 0;
var debugAccel, debugAccelStartX, debugAccelStartY, debugAccelLimit, vecDebug;
var centerIndicator, debugText, timeSlider, tempSlider;
//numberAveraging
var AVERAGE_LENGTH = 5;
var gammaAvg = [], betaAvg = [];
//scripts
var b, t, su, d;
//window
var OFF_SCREEN = -100;
var state, updateEmitter, windowWidth, windowHeight,
  windowWidthHalf, windowHeightHalf, sf;
//interaction
var TOUCH_SLOP = 20;
var UNLOCK_THRESHOLD = 3;
var TOUCH_MULTIPLIER = 1.6;
var touchLayer, touchInit, touchmove, mSlideInd,
  touching, touchChangeX, touchChangeY, touchNew, movingCid = false,
  unlocking = false, stunned = false, tappingButton = false, dropEnabled = false;
var touchHighLight;
//time
var CLOCK_POS_Y = 39;
var DATE_POS_Y = 76;
var PADDING = 20;
var time, elapsedTime, displayTimeText, displayDateText, textVisible = false, tempText, conditionText;
//sun
var sunRadius;
//ORIENTATION
// var TOP_OFFSET = 10;
// var MID_OFFSET = 50;
// var BACK_OFFSET = 75;
var PERSPECTIVE_OFFSET = 35;
var TRIANGLES_OFFSET = 100;
var absolute, alpha, beta, gamma;
//RENDERING
var renderer, stage, artCanvas;
//weather
var weatherCode, temp, tempNum = 30;
//background
var EVOLVE_MAX = 12;
var EVOLVE_MIN = 6;
var SEGMENTS = 6;
var TRIANGLE_PADDING = 200;
var background, vertexMatrix = [], sunGradient, vertexRadius, randomMatrix = [],
  randomDots = [], trianglesData = [], triangleContainer, triangleColor = 0x000000,
  triangleBlend = PIXI.BLEND_MODES.MULTIPLY;

//platform
var isMobile = false;

//Aliases
var Container = PIXI.Container,
  autoDetectRenderer = PIXI.autoDetectRenderer,
  loader = PIXI.loader,
  resources = PIXI.loader.resources,
  Sprite = PIXI.Sprite,
  Text = PIXI.Text,
  Rect = PIXI.Rectangle,
  g = PIXI.Graphics,
  tick = PIXI.ticker.Ticker;

checkMobile();

function checkMobile(){
  if(typeof EVENTS == 'undefined'){
    console.log('not mobile');
    //Create the renderer
    //this is only used for previewing on desktop
    renderer = autoDetectRenderer(360, 640, {antialias: true,
      resolution: window.devicePixelRatio});
    // console.log('ratio: ' + window.devicePixelRatio);
    // renderer.options = {antialias: true};
    renderer.backgroundColor = 0xF4F4FC;
    renderer.view.style.position = 'absolute';
    renderer.view.style.display = 'block';
    renderer.autoResize = true;
    // renderer.antialias = true;
    renderer.resize(window.innerWidth, window.innerHeight);

    //Add the canvas to the HTML document
    document.body.appendChild(renderer.view);

    //Create a container object called the 'stage'
    stage = new Container();

    loadAssets();

  } else {
    console.log('events are DEFINED, we are go for mobile and to wait for init');
    isMobile = true;
  }
}

//Load all image assets
function loadAssets(){
  loader
    .add([
      'img/raindrop.png',
      'img/rad_gradient.png',
      'img/sun_ray.png',
      'img/touch_gradient.png',
      'img/cloud.png',
      'img/snow.png',
      'img/snow2.png'
    ])
    .on('progress', loadProgressHandler)
    .load(getScripts); //after completing load all scripts
}


//after each image is loaded, fire off this function as a progress indicator
function loadProgressHandler(){
  console.log('loading');
}

//side load all required script files
function getScripts(){
  //list all scripts needed
  console.log('loading scripts');
  var scriptsToLoad = [
    'libs/TweenMax.js',
    'libs/TimelineLite.js',
    'libs/pixi-particles.js',
    'libs/PathParticle.js',
    'libs/weather.js'];

  if(!isMobile){
      scriptsToLoad.push('libs/font.js');
  }

  console.log('loading scripts: ' + scriptsToLoad);

  scriptsToLoad.forEach(function(src) {
    var script = document.createElement('script');
    script.src = src;
    script.async = false;

    //if we are at the end of the array, run the setup function
  	if (scriptsToLoad[scriptsToLoad.length - 1] == src) {
  		script.onload = function () {
        //we finished loading all of the scripts, start the setup
  			setup();
  		}
  	}
    document.head.appendChild(script);
  });
}

//////////////////////////////////////////////////////////////////// !SETUP

//init is called from live lock screen source, it will replace the stage and
//renderer with its own versions
function init(s, r){
  console.log('init');
  stage = s;
  renderer = r;

  // ACTIONS.hideStatusBar();

  ACTIONS.setInteractivity(true);

  EVENTS.onPause = pauseOnEvent;

  EVENTS.onResume = resumeOnEvent;

  // EVENTS.onLockScreenDismissed = pauseOnEvent;

  loadAssets();
}

function resumeOnEvent(){
  updateText();

  displayTimeText.alpha = 0;
  displayTimeText.y += 30 * sf;
  displayDateText.alpha = 0;
  displayDateText.y += 30 * sf;
  TweenMax.to(displayTimeText, 0.3, {y: CLOCK_POS_Y, delay: 0.4, alpha: 1, ease: Quad.easeOut});
  TweenMax.to(displayDateText, 0.3, {y: DATE_POS_Y, delay: 0.5, alpha: 1, ease: Quad.easeOut});

  getWeatherType();
}

function pauseOnEvent(){
  state = pause;
}

function checkWeather(){

  if(isMobile){
    weatherCode = WEATHER.getCurrentWeather().condition_code;
    console.log(weatherCode);
  } else {
    weatherCode = Math.round(Math.random() * 47);
    console.log(weatherCode);
  }
}

function setup(){
  PIXI.RESOLUTION = window.devicePixelRatio;

  //changing the state variable will change what happens during the game loop
  state = play;
  time = new Date();

  //get window dimensions, used everywhere for varying screen sizes
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  windowWidthHalf = windowWidth / 2;
  windowHeightHalf = windowHeight / 2;

  //setup a multiplier to ensure all sizes the same on all screen sizes
  sf = getScaleFactor(640);
  scaleConstants();

  artCanvas = new Container();
  stage.addChild(artCanvas);

  makeBackground();

  createSunGradient();

  makeTouch();

  createParticleLayers();

  if(SOLO_BACKGROUND){
    background.tint = 0x003898;
    sunGradient.tint = 0x00b2ff;
  } else {
    getWeatherType();
  }

  DEBUG && initDebug();

  if (window.DeviceOrientationEvent) {
   console.log("DeviceOrientation is supported");
   window.addEventListener('deviceorientation', devOrientHandler, false);
  }

  //test filter
  var pixFilter = new PIXI.filters.PixelateFilter();

  var pixel = new PIXI.Point(10, 10);
  pixFilter.size = (pixel);

  var bloomFilter = new PIXI.filters.BloomFilter();

  // bloomFilter.blur = 10;
  //
  // particlesContainer.filters = [bloomFilter];

  //Tell the 'renderer' to 'render' the 'stage'
  renderer.render(stage);

  //setup fonts
  var font = new Font();
  font.fontFamily = "Roboto-Thin";
  font.src = "fonts/Roboto-Thin.ttf";
  font.onload = createText;

  getTemp();
  updateBackgroundToTemp();

  gameLoop();
}

//////////////////////////////////////////////////////////////////// !BACKGROUND
function makeBackground(){
  background = new g;
  background.beginFill(0xFFFFFF);
  background.drawRect(0, 0, windowWidth, windowHeight);
  artCanvas.addChild(background);

  createVertexMatrix(SEGMENTS, TRIANGLE_PADDING);

  createRandomVertexMatrix();

  createtrianglesData();

  initTriangles();

  randomizeVertexMatrix();

  randomizeTriangleAlpha();

  console.log(trianglesData);
}

function createVertexMatrix(rowSize, padding){
  var widthSegment = (windowWidth + padding * 2) / (rowSize - 2);

  var colSize = Math.round(windowHeight / widthSegment) + 2;

  var heightSegment = (windowHeight + padding * 2) / (colSize - 1);

  console.log("widthSegment: " + widthSegment + ' ' + windowHeight % widthSegment);

  // widthSegment > heightSegment ? vertexRadius = heightSegment / 2 : vertexRadius = widthSegment / 2;
  vertexRadius = widthSegment / 2;

  for(var row = 0; row < rowSize; row ++){
    vertexMatrix[row] = [];
    for(var col = 0; col < colSize; col++){
      var offset = col % 2 == 0 ? 0 : widthSegment / 2;

      vertexMatrix[row][col] = {
        x: widthSegment * row - padding - offset,
        y: heightSegment * col - padding
      };
    }
  }
}

function createRandomVertexMatrix(){
  for(var row = 0; row < vertexMatrix.length; row ++){
    randomMatrix[row] = [];
    for(var col = 0; col < vertexMatrix[row].length; col++){

      var randomAngle = Math.random() * getRadians(360);
      var randomRadius = Math.random() * vertexRadius;
      var randomPosX = vertexMatrix[row][col].x + randomRadius * Math.cos(randomAngle);
      var randomPosY = vertexMatrix[row][col].y + randomRadius * Math.sin(randomAngle);

      randomMatrix[row][col] = {
        x: randomPosX,
        y: randomPosY
      }
    }
  }
}

function randomizeVertexMatrix(){
  for(var row = 0; row < randomMatrix.length; row ++){
    for(var col = 0; col < randomMatrix[row].length; col++){
      wiggleVertexPoint(vertexMatrix[row][col], randomMatrix[row][col]);
    }
  }
}

function wiggleVertexPoint(vertex, randomized){
  var duration = Math.random() * (EVOLVE_MAX - EVOLVE_MIN) + EVOLVE_MIN;

  var randomAngle = Math.random() * getRadians(360);
  var randomRadius = Math.random() * vertexRadius;
  var randomPosX = vertex.x + randomRadius * Math.cos(randomAngle);
  var randomPosY = vertex.y + randomRadius * Math.sin(randomAngle);

  var tweenProps = {
    ease: Quad.easeInOut,
    onComplete: wiggleVertexPoint,
    onCompleteParams: [vertex, randomized],
    x: randomPosX,
    y: randomPosY
  };

  TweenMax.to(randomized, duration, tweenProps);
}

function highlightVertices(){
  for(var row = 0; row < vertexMatrix.length; row ++){
    randomDots[row] = [];
    for(var col = 0; col < vertexMatrix[row].length; col++){
      var dot = new g;
      dot.beginFill(0x000000, 0.2);
      dot.drawCircle(0, 0, 2);
      dot.position.set(vertexMatrix[row][col].x, vertexMatrix[row][col].y);
      debugLayer.addChild(dot);

      var randomDot = new g;
      randomDot.beginFill(0xffffff, 0.2);
      randomDot.drawCircle(0, 0, 2);
      randomDot.position.set(vertexMatrix[row][col].x, vertexMatrix[row][col].y);
      debugLayer.addChild(randomDot);
      randomDots[row][col] = randomDot;

      var vRadius = new g;
      // vRadius.beginFill(0x0000ff);
      vRadius.lineStyle(2, 0xffffff, 0.2);
      vRadius.drawCircle(0, 0, vertexRadius);
      vRadius.alpha = 0.1;
      vRadius.position.set(vertexMatrix[row][col].x, vertexMatrix[row][col].y);
      debugLayer.addChild(vRadius);
    }
  }
}

function updateRandomDots(){
  for(var row = 0; row < vertexMatrix.length; row ++){
    for(var col = 0; col < vertexMatrix[row].length; col++){
      var randomDot = randomDots[row][col];
      randomDot.position.set(
        randomMatrix[row][col].x,
        randomMatrix[row][col].y
      )
    }
  }
}

function createtrianglesData(){
  for(var row = 0; row < randomMatrix.length; row ++){
    for(var col = 0; col < randomMatrix[row].length; col++){
      if(row != randomMatrix.length - 1 && col != randomMatrix[row].length - 1){
        if(col % 2 == 0){
          //even row
          newTriangle({
            v1: randomMatrix[row][col],
            v2: randomMatrix[row + 1][col],
            v3: randomMatrix[row + 1][col + 1]
          });

          newTriangle({
            v1: randomMatrix[row][col],
            v2: randomMatrix[row][col + 1],
            v3: randomMatrix[row + 1][col + 1]
          });
        } else {
          //odd row
          newTriangle({
            v1: randomMatrix[row][col],
            v2: randomMatrix[row + 1][col],
            v3: randomMatrix[row][col + 1]
          });

          newTriangle({
            v1: randomMatrix[row + 1][col],
            v2: randomMatrix[row][col + 1],
            v3: randomMatrix[row + 1][col + 1]
          });
        }
      }

    }
  }
}

function newTriangle(triangleData){
  trianglesData.push(triangleData);
}

function initTriangles(){
  triangleContainer = new Container();
  artCanvas.addChild(triangleContainer);

  for(var i = 0; i < trianglesData.length; i++){
    var triangle = new g;
    triangle.alpha = Math.random() * (0.9 - 0.3) + 0.3;
    // triangle.alpha = 1;
    triangleContainer.addChild(triangle);
  }
}

function drawTriangles(){
  for(var i = 0; i < triangleContainer.children.length; i++){
    var triangle = triangleContainer.getChildAt(i);

    triangle.clear();
    // triangle.lineStyle(2, 0xffffff, 0.5);
    triangle.beginFill(triangleColor);
    triangle.moveTo(trianglesData[i].v1.x, trianglesData[i].v1.y);
    triangle.lineTo(trianglesData[i].v2.x, trianglesData[i].v2.y);
    triangle.lineTo(trianglesData[i].v3.x, trianglesData[i].v3.y);
    triangle.lineTo(trianglesData[i].v1.x, trianglesData[i].v1.y);
    triangle.blendMode = triangleBlend;
  }
}

function randomizeTriangleAlpha(){
  for(var i = 0; i < triangleContainer.children.length; i++){
    wiggleTriangleAlpha(triangleContainer.getChildAt(i));
  }
}

function wiggleTriangleAlpha(triangle){
  var duration = Math.random() * (EVOLVE_MAX - EVOLVE_MIN) + EVOLVE_MIN;

  var tweenProps = {
    ease: Quad.easeInOut,
    onComplete: wiggleTriangleAlpha,
    onCompleteParams: [triangle],
    alpha: Math.random() * (0.9 - 0.3) + 0.3
  };

  TweenMax.to(triangle, duration, tweenProps);
}

//////////////////////////////////////////////////////////////////// !TEXT

function createText(){
  console.log('text loaded');

  var hours = time.getHours() > 12 ? time.getHours() - 12 : time.getHours();
  var minutes = time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes();
  displayTimeText = new Text(hours + ':' + minutes,{
    font: 36 * sf + 'px Roboto-Thin', fill: 'white'
  });
  stage.addChild(displayTimeText);
  displayTimeText.position.set(PADDING, CLOCK_POS_Y + 30 * sf);
  displayTimeText.alpha = 0;
  TweenMax.to(displayTimeText, 0.3, {y: CLOCK_POS_Y, delay: 0.4, alpha: 1, ease: Quad.easeOut});

  var day = checkDay();
  var month = checkMonth();
  displayDateText = new Text(day + ', ' + month + ' ' + time.getDate(),{
    font: 12 * sf + 'px Roboto-Thin', fill: 'white'
  });
  stage.addChild(displayDateText);
  displayDateText.position.set(PADDING, DATE_POS_Y + 30 * sf);
  displayDateText.alpha = 0;
  TweenMax.to(displayDateText, 0.3, {y: DATE_POS_Y, delay: 0.5, alpha: 1, ease: Quad.easeOut});

  var temp = isMobile ? WEATHER.getCurrentWeather().temperature : Math.round(Math.random() * 100);
  tempText = new Text(temp + '\xB0', {
    font: 36 * sf + 'px Roboto-Thin', fill: 'white'
  });
  stage.addChild(tempText);
  var tempPosX = windowWidth - PADDING - tempText.width;
  tempText.position.set(tempPosX, CLOCK_POS_Y + 30 * sf);
  tempText.alpha = 0;
  TweenMax.to(tempText, 0.3, {y: CLOCK_POS_Y, delay: 0.6, alpha: 1, ease: Quad.easeOut});

  var conditionType = isMobile ? WEATHER.getCurrentWeather().condition : 'Rain Showers';
  conditionText = new Text(conditionType, {
    font: 12 * sf + 'px Roboto-Thin', fill: 'white'
  });
  stage.addChild(conditionText);
  var conditionPosX = windowWidth - PADDING - conditionText.width;
  conditionText.position.set(conditionPosX, DATE_POS_Y + 30 * sf);
  conditionText.alpha = 0;
  TweenMax.to(conditionText, 0.3, {y: DATE_POS_Y, delay: 0.7, alpha: 1, ease: Quad.easeOut});

  setInterval(updateText, 1000);
}

function checkMonth(){
  switch (time.getMonth()) {
    case 0:
        return "January";
        break;
    case 1:
        return "February";
        break;
    case 2:
        return "March";
        break;
    case 3:
        return "April";
        break;
    case 4:
        return "May";
        break;
    case 5:
        return "June";
        break;
    case 6:
        return "July";
        break;
    case 7:
        return "August";
        break;
    case 8:
        return "September";
        break;
    case 9:
        return "October";
        break;
    case 10:
        return "November";
        break;
    case 11:
        return "December";
        break;
  }
}

function checkDay(){
  switch (time.getDay()) {
    case 0:
        return "Sunday";
        break;
    case 1:
        return "Monday";
        break;
    case 2:
        return "Tuesday";
        break;
    case 3:
        return "Wednesday";
        break;
    case 4:
        return "Thursday";
        break;
    case 5:
        return "Friday";
        break;
    case  6:
        return "Saturday";
        break;
  }
}

function updateText(){
  var hours = time.getHours() > 12 ? time.getHours() - 12 : time.getHours();

  var minutes = time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes();

  displayTimeText.text = hours + ':' + minutes;

  var day = checkDay();
  var month = checkMonth();

  displayDateText.text = day + ', ' + month + ' ' + time.getDate();

  getTemp();

  tempText.text = temp + '\xB0';
  var tempPosX = windowWidth - PADDING - tempText.width;
  tempText.position.set(tempPosX, CLOCK_POS_Y);

  var conditionType = isMobile ? WEATHER.getCurrentWeather().condition : 'Rain Showers';
  conditionText.text = conditionType;
  var conditionPosX = windowWidth - PADDING - conditionText.width;
  conditionText.position.set(conditionPosX, DATE_POS_Y);

  // console.log('updating time!');

  updateBackgroundToTemp();
}

function getTemp(){
  if(DEBUG){
    temp = Math.ceil(rangeMapper(tempSlider.y, 210 * sf, 490 * sf, 100, 0)) + '°F';
  } else {
    // temp = isMobile ? WEATHER.getCurrentWeather().temperature : (Math.round(Math.random() * 100)+ '°F');
    if(isMobile){
      temp = WEATHER.getCurrentWeather().temperature
    } else {
      tempNum == 90 ? tempNum = 30 : tempNum++;
      temp = tempNum + '°F';
    }
  }

  // temp = '54°F';

  temp = temp.replace(/\D/g,'');

  // temp -= '°F';

  // console.log(temp);
}

//////////////////////////////////////////////////////////////////// !BACKGROUNDCOLOR

function updateBackgroundToTemp(){
  var colors = [
    {bg: '#204947', light: '#00dbcf', particle: '#c7f9f4'},
    {bg: '#0c6190', light: '#00a8e6', particle: '#c1fce5'},
    {bg: '#00552a', light: '#00c638', particle: '#edffbf'},
    {bg: '#5c0077', light: '#be00cf', particle: '#fec3ff'},
    {bg: '#6b0000', light: '#df5100', particle: '#ffecbb'},
  ];

  var minTemp = 32;
  var maxTemp = 90;

  var tempRatio = rangeMapper(temp, minTemp, maxTemp, 0, 1, true);

  // console.log(tempRatio);

  var ratioInterval = 1 / (colors.length - 1);
  var minRatio, maxRatio;

  var colorA, colorB;

  if(tempRatio == 0){
    colorA = colors[0];
    colorB = colors[1];
    minRatio = 0;
    maxRatio = ratioInterval;
  }

  if(tempRatio == 1){
    colorA = colors[colors.length - 2];
    colorB = colors[colors.length - 1];
    minRatio = ratioInterval * (colors.length - 2);
    maxRatio = ratioInterval * (colors.length - 1);
  }

  if(tempRatio != 0 && tempRatio != 1){
    for(var i = 0; i < colors.length - 1; i++){
      if(tempRatio > ratioInterval * i && tempRatio < ratioInterval * (i + 1)){
        colorA = colors[i];
        colorB = colors[i + 1];
        minRatio = ratioInterval * i;
        maxRatio = ratioInterval * (i + 1);
      }
    }
  }

  colorA.bg = hexToRgb(colorA.bg);
  colorB.bg = hexToRgb(colorB.bg);

  colorA.light = hexToRgb(colorA.light);
  colorB.light = hexToRgb(colorB.light);

  colorA.particle = hexToRgb(colorA.particle);
  colorB.particle = hexToRgb(colorB.particle);

  var colorRatio = rangeMapper(tempRatio, minRatio, maxRatio, 0, 1);

  var bgR = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.bg.r, colorB.bg.r));
  var bgG = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.bg.g, colorB.bg.g));
  var bgB = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.bg.b, colorB.bg.b));

  var lightR = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.light.r, colorB.light.r));
  var lightG = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.light.g, colorB.light.g));
  var lightB = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.light.b, colorB.light.b));

  var particleR = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.particle.r, colorB.particle.r));
  var particleG = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.particle.g, colorB.particle.g));
  var particleB = Math.ceil(rangeMapper(colorRatio, 0, 1, colorA.particle.b, colorB.particle.b));

  var bg = hexStringToNum(rgbToHex(bgR, bgG, bgB));
  var light = hexStringToNum(rgbToHex(lightR, lightG, lightB));

  background.tint = bg;
  sunGradient.tint = light;

  for(var i = 0; i < particleEmitters.length; i++){
    var emitter = particleEmitters[i];

    // console.log(emitter.startColor);
    emitter.startColor = [particleR, particleG, particleB];
    emitter.endColor = [particleR, particleG, particleB];
  }

  for(var i = 0; i < windEmitters.length; i++){
    var emitter = windEmitters[i].emitter;
    emitter.startColor = [particleR, particleG, particleB];
    emitter.endColor = [particleR, particleG, particleB];
  }

}

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexNumToString(hex){
  var string = hex.toString(16);

  if(string.length < 6){
    var zerosToAdd = 6 - string.length;

    var zerosString = '';

    for(var i = 0; i < zerosToAdd; i++){
      zerosString += '0';
    }

    return zerosString += string;
  } else {
    return string;
  }

  console.log(string.length);
}

function hexStringToNum(hex){
  return parseInt(hex, 16)
}


//////////////////////////////////////////////////////////////////// !SUNGRADIENT

function createSunGradient(){
  sunGradient = createSprite('img/rad_gradient.png');
  sunGradient.tint = 0xff00ff;
  sunGradient.anchor.set(0.5, 0.5);
  // sunGradient.scale.set(0.3, 0.3);
  sunGradient.position.set(windowWidthHalf, windowHeight * 0.75);
  sunGradient.blendMode = PIXI.BLEND_MODES.SCREEN;
  artCanvas.addChild(sunGradient);

  sunRadius = Math.sqrt(Math.pow(sunGradient.x, 2) + Math.pow(sunGradient.y, 2));

  sunGradient.width = sunRadius * 2;
  sunGradient.height = sunRadius * 2;
}

function updateSunGradient(){
  if(!DEBUG){
    elapsedTime = (time.getHours() * 60) + time.getMinutes();
  } else {
    elapsedTime = rangeMapper(timeSlider.x, SLIDE_PAD, windowWidth - SLIDE_PAD, 0, 24 * 60);
  }

  sunGradient.rotation = rangeMapper(elapsedTime,
    0,
    (24 * 60),
    0,
    getRadians(-360));

  if(elapsedTime < 12 * 60){
    sunGradient.alpha = rangeMapper(elapsedTime, 0, 12 * 60, 0.8, 1, true);
  } else {
    sunGradient.alpha = rangeMapper(elapsedTime, 12 * 60, 24 * 60, 1, 0.8, true);
  }

}

//////////////////////////////////////////////////////////////////// !DEBUG

function initDebug(){
  debugLayer = new Container();
  stage.addChild(debugLayer);

  debugText = new Text('DEBUG: \na: ' + alpha + '\nb: ' + beta + '\ng: ' + gamma);
  debugLayer.addChild(debugText);
  debugText.alpha = DEBUG ? 0.5 : 0;

  centerIndicator = new g;
  centerIndicator.beginFill(0x00ff00);
  centerIndicator.drawCircle(0, 0, 30);
  centerIndicator.alpha = DEBUG ? 0.5 : 0;
  debugLayer.addChild(centerIndicator);

  createDebugAccel();

  createDebugTimeScrubber();

  createDebugTempScrubber();

  highlightVertices();

  // createVectorDebug();
}

function createVectorDebug(){
  vecDebug = new g;
  vecDebug.beginFill(0xffff00);
  vecDebug.drawCircle(0, 0, 100);
  vecDebug.alpha = 0.5;
  vecDebug.position.set(windowWidthHalf, windowHeightHalf);
  debugLayer.addChild(vecDebug);

  //setInteractEvents(element, start, end, move, cancel)
  setInteractEvents(vecDebug, startDebugTouch, vecEnd, vecMove, vecEnd);
}

function vecMove(){
  if(this.isDown){
    this.position.x = this.data.getLocalPosition(this.parent).x;
    this.position.y = this.data.getLocalPosition(this.parent).y;

  }
}

function vecEnd(){
  this.isDown = false;
}

function createDebugAccel(){

  debugAccelStartX = windowWidth - DEBUG_ACCEL_LIMIT;
  debugAccelStartY = DEBUG_ACCEL_LIMIT;

  debugAccel = new g;
  debugAccel.beginFill(0xff00ff);
  debugAccel.drawCircle(0, 0, 30);
  debugLayer.addChild(debugAccel);
  debugAccel.alpha = DEBUG ? 0.5 : 0;
  debugAccel.interactive = true;
  debugAccel.position.set(debugAccelStartX, debugAccelStartY);

  setInteractEvents(debugAccel, startDebugTouch, debugAccelEnd, debugAccelMove, debugAccelEnd);

}

function startDebugTouch(event){
  this.isDown = true;
  this.data = event.data;
}

function debugAccelMove(){
  if(this.isDown){
    var touchPos = this.data.getLocalPosition(this.parent);

    if(touchPos.x > debugAccelStartX - DEBUG_ACCEL_LIMIT
      && touchPos.x < debugAccelStartX + DEBUG_ACCEL_LIMIT){
      debugAccel.position.x = this.data.getLocalPosition(this.parent).x;
    }

    if(touchPos.y > debugAccelStartY - DEBUG_ACCEL_LIMIT
      && touchPos.y < debugAccelStartY + DEBUG_ACCEL_LIMIT){
      debugAccel.position.y = this.data.getLocalPosition(this.parent).y;
    }

  }

}

function debugAccelEnd(){
  this.isDown = false;
  debugAccel.position.set(debugAccelStartX, debugAccelStartY);
}

function createDebugTempScrubber(){
  var slideBG = new g;
  slideBG.beginFill(0xFFFFFF, 0.3);
  slideBG.drawRoundedRect(0, 0, 20 * sf, 300 * sf, 10 * sf);
  slideBG.position.set(
    SLIDE_PAD,
    200 * sf
  )
  debugLayer.addChild(slideBG);

  tempSlider = new g;
  tempSlider.beginFill(0xff0000);
  tempSlider.drawCircle(0, 0, 8 * sf);
  tempSlider.position.set(
    SLIDE_PAD + 10 * sf,
    (200 + 150) * sf
  )
  debugLayer.addChild(tempSlider);
  setInteractEvents(tempSlider, startDebugTouch, timeSlideEnd, tempSlideMove, timeSlideEnd);
}

function tempSlideMove(){
  if(this.isDown){
    var touchPos = this.data.getLocalPosition(this.parent);

    if(touchPos.y > 200 * sf + 10 * sf
      && touchPos.y < 500 * sf - 10 * sf){
      this.position.y = this.data.getLocalPosition(this.parent).y;
    }

    updateText();
  }
}

function createDebugTimeScrubber(){

  var slideBG = new g;
  slideBG.beginFill(0xFFFFFF, 0.3);
  slideBG.drawRoundedRect(0, 0, windowWidth - SLIDE_PAD * 2, 20 * sf, 10 * sf);
  slideBG.position.set(
    SLIDE_PAD,
    windowHeight - SLIDE_PAD - 20 * sf
  )
  debugLayer.addChild(slideBG);

  timeSlider = new g;
  timeSlider.beginFill(0xff0000);
  timeSlider.drawCircle(0, 0, 8 * sf);
  timeSlider.position.set(
    windowWidthHalf,
    windowHeight - SLIDE_PAD - 10 * sf
  )
  debugLayer.addChild(timeSlider);
  setInteractEvents(timeSlider, startDebugTouch, timeSlideEnd, timeSlideMove, timeSlideEnd);
}

function timeSlideMove(){
  if(this.isDown){
    var touchPos = this.data.getLocalPosition(this.parent);

    if(touchPos.x > SLIDE_PAD + 10 * sf
      && touchPos.x < windowWidth - SLIDE_PAD - 10 * sf){
      this.position.x = this.data.getLocalPosition(this.parent).x;
    }
  }
}

function timeSlideEnd(){
  this.isDown = false;
}

function updateDebug(){
  // if(!SOLO_BACKGROUND){
  //   var totalParticles = topLevelParticles.particleCount + midLevelParticles.particleCount + backLevelParticles.particleCount;
  //
  //   debugText.text = 'DEBUG: \na: ' + alpha + '\nb: ' + beta + '\ng: ' + gamma +
  //   '\ntotalParticles: ' + totalParticles +
  //   '\nframeRate: ' + fps.getFPS();
  // }

  centerIndicator.position.x = rangeMapper(gamma, -90, 90, windowWidth, 0);
  centerIndicator.y = rangeMapper(beta, 0, 89, windowHeight, 0);

  updateRandomDots();
}

//////////////////////////////////////////////////////////////////// !LIGHTNING

// createLightning({flashDelay: 3, flashRate: 5});

function createLightning(props){
  if(typeof lightningContainer == 'undefined'){
    lightningContainer = new Container();
    artCanvas.addChild(lightningContainer);

    var bloomFilter = new PIXI.filters.BloomFilter();
    bloomFilter.blur = 4;
    lightningContainer.filters = [bloomFilter];

  } else {
    lightningContainer.removeChildren();
    lightningContainer.path = [];
    lightningContainer.tween.kill();
  }
  updaters.push(updateLightingPath);

  var bolt = new g;
  lightningContainer.addChild(bolt);

  var whiteFill = new g;
  whiteFill.beginFill(0xffffff, 0.3);
  whiteFill.drawRect(0, 0, windowWidth, windowHeight);
  lightningContainer.addChild(whiteFill);

  lightningContainer.alpha = 0;

  lightningContainer.path = createLightningPath();

  drawLighting();

  animateLighting(props.flashDelay, props.flashRate);

}

function updateLightingPath(){
  drawLighting();
  // console.log('update lighting');
}

function animateLighting(flashDelay, flashRate){
  var randomizedDelay = Math.random() * flashDelay;

  lightningContainer.tween = new TimelineLite({onComplete: createLightning,
    onCompleteParams: [{flashDelay: flashDelay, flashRate: flashRate}]});
  lightningContainer.tween.to(lightningContainer, flashRate * 0.3, {alpha: 1}).to(lightningContainer, flashRate, {alpha: 0.4}).
    to(lightningContainer, flashRate * 0.4, {alpha: 0.7}).to(lightningContainer, flashRate * 5, {alpha: 0}).
    to(lightningContainer, randomizedDelay, {alpha: 0});
}

function drawLighting(){
  var path = lightningContainer.path;
  var bolt = lightningContainer.getChildAt(0);
  bolt.clear();
  bolt.lineStyle(4, 0xffffff, 1);
  bolt.moveTo(randomMatrix[path[0].x][path[0].y].x, randomMatrix[path[0].x][path[0].y].y);
  for(var i = 1; i < path.length; i++){
    bolt.lineTo(randomMatrix[path[i].x][path[i].y].x, randomMatrix[path[i].x][path[i].y].y);
  }

}

function createLightningPath(){
  var path = [];

  var limit = {
    x: randomMatrix.length,
    y: randomMatrix[0].length
  }

  var ranStartX = Math.floor(Math.random() * limit.x);
  var ranStartY = Math.floor(Math.random() * limit.y);

  // console.log('ranStart: ' + ranStart);

  var x = ranStartX, y = ranStartY;

  console.log(x + ' ' + y);

  for(var i = 0; i < 20; i++){
    path.push({x: x, y: y});

    var change = Math.random() < 0.5 ? -1 : 1;

    if(i % 2 != 0){

      if(x + change >= limit.x || x + change < 0){
        change *= -1;
      }

      if(!checkForExistingPoint(x + change, y, path)){
        x += change;
      } else {
        change *= -1;
        if(x + change >= limit.x || x + change < 0){
          break;
        }

        if(!checkForExistingPoint(x + change, y, path)){
          x += change;
        } else {
          break;
        }
      }


    } else {

      if(y + change >= limit.y || y + change < 0){
        change *= -1;
      }

      if(!checkForExistingPoint(x, y + change, path)){
        y += change;
      } else {
        change *= -1;
        if(y + change >= limit.y || y + change < 0){
          break;
        }

        if(!checkForExistingPoint(x, y + change, path)){
          y += change;
        } else {
          break;
        }
      }
    }
  }

  return path;

}

function checkForExistingPoint(x, y, path){
  for(var i = 0; i < path.length; i++){
    if(x == path[i].x &&
      y == path[i].y){
      console.log('found same point');

      return true;
    }

  }
  return false;
}

//////////////////////////////////////////////////////////////////// !SNOW

// createSnow({frequency: 0.05, speed: 500, scaleStart: 0.3, scaleEnd: 0.3,
//   alphaStart: 0.8, alphaEnd: 0.5, rotationMin: 50, rotationMax: 80, rotationSpeedMax: 200, depth: 0});

function createSnow(props){

  var container = new Container();
  particlesContainer.addChild(container);
  container.depth = props.depth;

  var speed = props.speed * sf;
  var life = (windowHeight / speed) * 2.5;
  var scaleStart = props.scaleStart * sf;
  var scaleEnd = props.scaleEnd * sf;

  // console.log('life ' + life);

  var particles = new PIXI.particles.Emitter(
    container,
    [PIXI.Texture.fromImage('img/snow.png'), PIXI.Texture.fromImage('img/snow2.png')],
    {
			"alpha": {
        "start": props.alphaStart,
        "end": props.alphaEnd
			},
			"scale": {
				"start": props.scaleStart,
				"end": props.scaleEnd,
				"minimumScaleMultiplier":0.5
			},
			"color": {
				"start": "ffffff",
				"end": "ffffff"
			},
			"speed": {
				"start": props.speed,
				"end": props.speed
			},
			"startRotation": {
        "min": props.rotationMin,
        "max": props.rotationMax
			},
			"rotationSpeed": {
				"min": 0,
				"max": props.rotationSpeedMax
			},
			"lifetime": {
        "min": life,
        "max": life
			},
			"blendMode": "normal",
			"ease": [
				{
					"s": 0,
					"cp": 0.379,
					"e": 0.548
				},
				{
					"s": 0.548,
					"cp": 0.717,
					"e": 0.676
				},
				{
					"s": 0.676,
					"cp": 0.635,
					"e": 1
				}
			],
			"frequency": props.frequency,
			"emitterLifetime": 0,
			"maxParticles": 1500,
			"pos": {
				"x": 0,
				"y": 0
			},
			"addAtBack": false,
			"spawnType": "rect",
      "spawnRect": {
        "x": -windowWidth * 1.5,
        "y": -30,
        "w": windowWidth * 3,
        "h": 0
      },
      // "extraData":{
			// 	"path": "sin(x/300) * 200"
			// }
		}
  );

  // particles.particleConstructor = PIXI.particles.PathParticle;
  console.log(particles.particleConstructor);

  particleEmitters.push(particles);

  elapsed = Date.now();

}

//////////////////////////////////////////////////////////////////// !RAIN

// speed, interval, size, opacity, color?, width emitter(for rain)?

var particleEmitters = [];

// createRain({frequency: 0.025, speed: 600, scaleStart: 0.4, scaleEnd: 0.5, alphaStart: 1, alphaEnd: 1, rotation: 70});

function createRain(props){

  var container = new Container();
  particlesContainer.addChild(container);
  container.depth = props.depth;

  var speed = props.speed * sf;
  var life = (windowHeight / speed) * 2;
  var scaleStart = props.scaleStart * sf;
  var scaleEnd = props.scaleEnd * sf;

  // console.log('life ' + life);

  var particles = new cloudkid.Emitter(
    container,
    [PIXI.Texture.fromImage('img/raindrop.png')],
    {
      "alpha": {
        "start": props.alphaStart,
        "end": props.alphaEnd
      },
      "scale": {
        "start": scaleStart,
        "end": scaleEnd
      },
      "color": {
		    "start": "#ffffff",
		    "end": "#ffffff"
	    },
      "speed": {
        "start": speed,
        "end": speed
      },
      "startRotation": {
        "min": props.rotation,
        "max": props.rotation
      },
      "rotationSpeed": {
        "min": 0,
        "max": 0
      },
      "lifetime": {
        "min": life,
        "max": life
      },
      "acceleration": {
        "x": 0,
        "y": 0
      },
      "rotation": 90,
      "blendMode": "normal",
      "frequency": props.frequency,
      "emitterLifetime": 0,
      "maxParticles": 500,
      "pos": {
        "x": 0,
        "y": 0
      },
      "addAtBack": false,
      "spawnType": "rect",
      "spawnRect": {
        "x": -windowWidth * 1.5,
        "y": -300,
        "w": windowWidth * 3,
        "h": 20
      }
    }
  );

  particles.minimumScaleMultiplier = 0.3;

  particleEmitters.push(particles);

  elapsed = Date.now();

}

//////////////////////////////////////////////////////////////////// !CLOUDS

// createClouds({frequency: 0.07, speed: 300, scaleStart: 1, scaleEnd: 0.4,
//   alphaStart: 0.4, alphaEnd: 0, rotation: 90, depth: 2});

var cloudParticles = [];

function createClouds(props){

  var container = new Container();
  particlesContainer.addChild(container);
  container.depth = props.depth;

  var speed = props.speed * sf;
  var life = (windowHeight / speed) * 2;
  var scaleStart = props.scaleStart * sf;
  var scaleEnd = props.scaleEnd * sf;

  var particles = new cloudkid.Emitter(
    container,
    [PIXI.Texture.fromImage('img/cloud.png')],
    {
      "alpha": {
        "start": props.alphaStart,
        "end": props.alphaEnd
      },
      "scale": {
        "start": scaleStart,
        "end": scaleEnd
      },
      "color": {
		    "start": "#ffffff",
		    "end": "#ffffff"
	    },
      "speed": {
        "start": speed,
        "end": speed
      },
      "startRotation": {
        "min": props.rotation,
        "max": props.rotation
      },
      "rotationSpeed": {
        "min": 0,
        "max": 0
      },
      "lifetime": {
        "min": life,
        "max": life
      },
      "acceleration": {
        "x": 0,
        "y": 0
      },
      "rotation": 90,
      "blendMode": "normal",
      "frequency": props.frequency,
      "emitterLifetime": 0,
      "maxParticles": 500,
      "pos": {
        "x": 0,
        "y": 0
      },
      "addAtBack": false,
      "spawnType": "rect",
      "spawnRect": {
        "x": props.side == 'left' ? -windowWidth : windowWidth * 2,
        "y": 0,
        "w": 0,
        "h": windowHeight
      }
    }
  );

  particles.minimumScaleMultiplier = 0.3;

  particleEmitters.push(particles);
  updaters.push(updateClouds);
  cloudParticles.push(particles);

  elapsed = Date.now();

}

function updateClouds(){
  for(var i  = 0; i < cloudParticles.length; i++){
    var emitter = cloudParticles[i];


  }
}

//////////////////////////////////////////////////////////////////// !WIND

function createWind(props){

  windEmitters = [];

  console.log('array length' + windEmitters.length);

  updaters.push(updateWind);

  elapsed = Date.now();

  var duration = props.duration;

  var delay = duration / props.strength;

  var container = new Container();
  particlesContainer.addChild(container);

  console.log('doing this?');

  for(var i = 0; i < props.strength; i++){

    console.log(i);

    windEmitters[i] = {};

    // windEmitters[i].path = makeRandomPath(3);

    if(i % 5 == 0){
      windEmitters[i].path = makeRandomPath(4);
    } else {
      windEmitters[i].path = makeRandomPath(3);
    }

    //create new emitter
    windEmitters[i].emitter = new cloudkid.Emitter(
      container,
      [PIXI.Texture.fromImage('img/sun_ray.png')],
      {
        "alpha": {
            "start": 0.6,
            "end": 0.3
          },
          "scale": {
            "start": Math.random() * (0.2 - 0.05) + 0.05,
            "end": 0
          },
          "color": {
    		    "start": "#caece4",
    		    "end": "#ffffff"
    	    },
          "speed": {
            "start": 100,
            "end": 100
          },
          "startRotation": {
            "min": 0,
            "max": 0
          },
          "rotationSpeed": {
            "min": 20,
            "max": 20
          },
          "lifetime": {
            "min": 1,
            "max": 1
          },
          "acceleration": {
            "x": 0,
            "y": 0
          },
          "blendMode": "normal",
          "frequency": props.duration * 0.01,
          "emitterLifetime": 0,
          "maxParticles": 500,
          "pos": {
            "x": windEmitters[i].path[0].x,
            "y": windEmitters[i].path[0].y
          },
          "addAtBack": false,
          "spawnType": "point"
      }
    );


    windEmitters[i].newSpawnPos = {
      x: windEmitters[i].path[0].x,
      y: windEmitters[i].path[0].y
    };

    windEmitters[i].lastPos = {
      x: windEmitters[i].path[0].x,
      y: windEmitters[i].path[0].y
    };

    animateEmitter(windEmitters[i], duration, i, delay);
  }

}

function animateEmitter(emitterObj, duration, i, delay){

  emitterObj.tween = TweenMax.to(emitterObj.newSpawnPos, duration,
    {bezier: {type: 'thru', curviness: 2, values: emitterObj.path},
    ease: Linear.easeNone, onUpdateParams: [emitterObj.emitter,
    emitterObj.newSpawnPos, emitterObj.lastPos],
    onUpdate: updateWindRotation, delay: i * delay,
    onComplete: completeWindAnimation, onCompleteParams: [emitterObj, duration, i, delay]});
}

function completeWindAnimation(emitterObj, duration, i, delay){
  // console.log(emitterObj.emitter.emit);
  emitterObj.emitter.emit = false;
  // console.log('trying to turn emitter off: ' + emitterObj.emitter.emit);

  // emitterObj.path = makeRandomPath(3);

  if(i % 10 == 0){
    emitterObj.path = makeRandomPath(4);
  } else {
    emitterObj.path = makeRandomPath(3);
  }

  emitterObj.newSpawnPos = {
    x: emitterObj.path[0].x,
    y: emitterObj.path[0].y
  };

  emitterObj.emitter.spawnPos.set(emitterObj.newSpawnPos.x, emitterObj.newSpawnPos.y);

  animateEmitter(emitterObj, duration, i, delay);
}

function makeRandomPath(points){
  var path = [];

  var rangeX = windowWidthHalf * sf;

  var rangeY = 500 * sf;

  path[0] = {x: -rangeX, y: Math.random() * (windowHeight - windowHeightHalf) + windowHeightHalf};

  var quadrantX = windowWidth / (points - 2);

  for(var i = 1; i < points - 1; i++){
    path[i] = {
      x: randomDimen((quadrantX * i) - (quadrantX / 2), rangeX),
      y: randomDimen(path[0].y, rangeY)
    }
  }

  path[points - 1] = {x: windowWidth + rangeX, y: randomDimen(path[0].y, rangeY)};

  // for(var i = 0; i < points; i++){
  //   console.log(path[i]);
  //   var dot = new g;
  //   dot.beginFill(0x00ff00);
  //   dot.drawCircle(0,0, 8);
  //   dot.position.set(path[i].x, path[i].y);
  //   midEmitterContainer.addChild(dot);
  // }

  return path;
}

function randomDimen(ref, range){
  var min = ref - range;
  var max = ref + range;

  return (Math.random() * (max - min)) + min;
}

function updateWindRotation(emitter, newSpawnPos, lastPos){
  if(!emitter.emit){emitter.emit = true;}

  var angleDegrees = Math.atan2(newSpawnPos.y - lastPos.y,
    newSpawnPos.x - lastPos.x) * (180 / Math.PI) + 180;

  // console.log('spawnPos: ' + p1.x + ' ' + p1.y);
  // console.log('angleDegrees: ' + angleDegrees);
  emitter.rotate(angleDegrees);
  emitter.spawnPos.set(newSpawnPos.x, newSpawnPos.y);
  // console.log(emitter.rotation + '  ' + emitter.spawnPos.x + '  ' + emitter.spawnPos.y);
  // console.log(newSpawnPos.x, newSpawnPos.y);

  lastPos.x = newSpawnPos.x;
  lastPos.y = newSpawnPos.y;
}

function updateWind(){
  // topLevelParticles.update((now - elapsed) * 0.001);

  for(var i = 0; i < windEmitters.length; i++){
    windEmitters[i].emitter.update((now - elapsed) * 0.001);
  }
  // console.log('updating wind');
}

//////////////////////////////////////////////////////////////////// !SUNLIGHT

// createSunLight({frequency: 0.07, speed: 500, scaleStart: 0.6, scaleEnd: 0.1,
//   alphaStart: 0.8, alphaEnd: 0.5, rotation: 70, depth: 0});

function createSunLight(props){

  var container = new Container();
  particlesContainer.addChild(container);
  container.depth = props.depth;

  var speed = props.speed * sf;
  var life = (windowHeight / speed) * 2;
  var scaleStart = props.scaleStart * sf;
  var scaleEnd = props.scaleEnd * sf;

  var particles = new cloudkid.Emitter(
    container,
    [PIXI.Texture.fromImage('img/sun_ray.png')],
    {
      "alpha": {
          "start": props.alphaStart,
          "end": props.alphaEnd
        },
        "scale": {
          "start": props.scaleStart,
          "end": props.scaleEnd
        },
        "color": {
  		    "start": "#ffffff",
  		    "end": "#ffffff"
  	    },
        "speed": {
          "start": speed,
          "end": speed
        },
        "startRotation": {
          "min": 180,
          "max": 360
        },
        "rotationSpeed": {
          "min": 0,
          "max": 0
        },
        "lifetime": {
          "min": life,
          "max": life
        },
        "acceleration": {
          "x": 0,
          "y": 0
        },
        "rotation": 90,
        "blendMode": "normal",
        "frequency": props.frequency,
        "emitterLifetime": 0,
        "maxParticles": 500,
        "pos": {
          "x": sunGradient.x + sunRadius * Math.cos(sunGradient.rotation + getRadians(90)),
          "y": sunGradient.y + sunRadius * Math.sin(sunGradient.rotation + getRadians(90))
        },
        "addAtBack": false,
        "spawnType": "point",
        "emit": false
    }
  );

  particleEmitters.push(particles);
  sunEmitters.push(particles);
  updaters.push(updateSunLight);

  elapsed = Date.now();

}

function updateSunLight(){

  var xPos = sunGradient.x + sunRadius * Math.cos(sunGradient.rotation + getRadians(90));
  var yPos = sunGradient.y + sunRadius * Math.sin(sunGradient.rotation + getRadians(90));

  for(var i = 0; i < sunEmitters.length; i++){
    var emitter = sunEmitters[i];
    emitter.spawnPos.set(xPos, yPos);
    emitter.rotate(sunGradient.rotation * (180 / Math.PI));
  }
}

//////////////////////////////////////////////////////////////////// !PERSPECTIVE

function createParticleLayers(){

  particlesContainer = new Container();
  artCanvas.addChild(particlesContainer);

}

function clearParticleContainers(){
  particlesContainer.removeChildren();

  if(typeof lightningContainer != 'undefined'){
    console.log('kill lightning');
    lightningContainer.tween.kill();
  }

  updaters = [];
}

function updateEmitterLayerPerspective(){

  var horiz = 0;
  var vert = 45;

  if(isMobile){
    horiz = smoothInput(gamma, gammaAvg);
    vert = smoothInput(beta, betaAvg);
  } else {
    if(DEBUG){
      horiz = rangeMapper(debugAccel.x - debugAccelStartX, -DEBUG_ACCEL_LIMIT, DEBUG_ACCEL_LIMIT, -90, 90);
      vert = rangeMapper(debugAccel.y - debugAccelStartY, -DEBUG_ACCEL_LIMIT, DEBUG_ACCEL_LIMIT, 0, 89);
    }
  }

  for(var i = 0; i < particlesContainer.children.length; i++){
    var layer = particlesContainer.getChildAt(i);

    layer.position.set(
      rangeMapper(horiz, -90, 90, PERSPECTIVE_OFFSET * layer.depth, -PERSPECTIVE_OFFSET * layer.depth, true),
      rangeMapper(vert, 0, 89, PERSPECTIVE_OFFSET * layer.depth, -PERSPECTIVE_OFFSET * layer.depth, true)
    )
  }

  triangleContainer.position.set(
    rangeMapper(horiz, -90, 90, TRIANGLES_OFFSET, -TRIANGLES_OFFSET, true),
    rangeMapper(vert, 0, 89, TRIANGLES_OFFSET / 2, -TRIANGLES_OFFSET / 2, true)
  )
}

function smoothInput(input, inputArray){
  var total = 0;

  inputArray.push(input);

  if(inputArray.length > AVERAGE_LENGTH){
    inputArray.splice(0, 1);
  }

  for(var i = 0; i < inputArray.length; i++){
    total += inputArray[i];
  }

  return total / inputArray.length;
}

//////////////////////////////////////////////////////////////////// !LOOP

function gameLoop(){

  state();

  requestAnimationFrame(gameLoop);
}

//////////////////////////////////////////////////////////////////// !STATES


function play(){
  //do stuff here
  DEBUG && updateDebug();
  updateEmitterLayerPerspective();
  updateSunGradient();
  drawTriangles();

  now = Date.now();

  time = new Date();

  //update particles container
  //update wind
  //update lightning

  for(var i = 0; i < updaters.length; i++){
    var updater = updaters[i];
    // console.log('trying to update');
    updater();
    // console.log('after update?');
  }

  for(var i = 0; i < particleEmitters.length; i++){
    var emitter = particleEmitters[i];

    emitter.update((now - elapsed) * 0.001);
  }

  elapsed = now;
  renderer.render(stage);
}

function pause(){

}

//////////////////////////////////////////////////////////////////// !TOUCH

function makeTouch(){
  touchLayer = new g;
  touchLayer.beginFill(0x00ff00, 0);
  touchLayer.drawRect(0,0,windowWidth, windowHeight);
  stage.addChild(touchLayer);

  // touchHighLight = new g;
  // touchHighLight.beginFill(0x00ffff, 1);
  // touchHighLight.drawCircle(0, 0, 100);
  // touchHighLight.position.set(windowWidthHalf, windowHeightHalf);
  // stage.addChild(touchHighLight);

  touchHighLight = createSprite('img/touch_gradient.png');
  addScaleXYProperties(touchHighLight);
  touchHighLight.alpha = 0;
  touchHighLight.scale.set(0, 0);
  touchHighLight.anchor.set(0.5, 0.5);
  touchHighLight.position.set(windowWidthHalf, windowHeightHalf);
  stage.addChild(touchHighLight);
  touchHighLight.blendMode = PIXI.BLEND_MODES.ADD;

  //setInteractEvents(element, start, end, move)
  setInteractEvents(touchLayer, onTouchStart, onTouchEnd, onTouchMove);
}

function onTouchStart(event){
  this.data = event.data;
  touchInit = this.data.getLocalPosition(this.parent);

  if(typeof touchHighLight.fade != 'undefined'){touchHighLight.fade.kill();}
  touchHighLight.fade = TweenMax.to(touchHighLight, 2, {alpha: 1, scaleX: 2, scaleY: 2, ease: Quad.easeOut});

}

var unlocking = false;

function onTouchMove(){
  touchNew = this.data.getLocalPosition(this.parent);
  touchChangeX = (touchNew.x - touchInit.x);
  touchChangeY = (touchNew.y - touchInit.y);

  touchHighLight.position.set(touchNew.x, touchNew.y);

  if(touchChangeY < 0 && Math.abs(touchChangeY) > TOUCH_SLOP){
    if(!unlocking){
      console.log('UNLOCK!!!');
      unlocking = true;
    }
  } else {
    if(unlocking){
      console.log('LOCK IT UP!!!');
      unlocking = false;
    }
  }
}

function onTouchEnd(){

  touchHighLight.fade.kill();
  touchHighLight.fade = TweenMax.to(touchHighLight, 0.3, {alpha: 0, scaleX: 0, scaleY: 0, ease: Quad.easeIn});

  // topLevelParticles.emit = false;
  // midLevelParticles.emit = false;
  // backLevelParticles.emit = false;

  // clearParticleContainers();

  // WEATHER_TYPES[currentWeatherType](3,40);
  //
  // currentWeatherType++;
  //
  // if(currentWeatherType == WEATHER_TYPES.length){
  //   currentWeatherType = 0;
  // }

  getWeatherType();

  if(isMobile){
    unlocking ? ACTIONS.unlock() : null;
  }

  unlocking = false;

  // resumeOnEvent();
  // getWeatherType();

  this.data = null;
}

//////////////////////////////////////////////////////////////////// !ORIENTATION

function devOrientHandler(event){
  // console.log('event occured');
  absolute = event.absolute;
  alpha = event.alpha;
  beta = event.beta;
  gamma = event.gamma;
}

//////////////////////////////////////////////////////////////////// !UTILITIES

function printMatrix(matrix){
  for(var i = 0; i < matrix.length; i++){
    var iter = i;
    if(i < 10){
      iter = ' ' + i;
    }
    var row = 'row ' + iter + ': ';
    for (var t = 0; t < matrix[i].length; t++){
      row += matrix[i][t] + ' ';
    }
    console.log(row);
  }
}

function getRadians(degrees){
  return degrees * Math.PI / 180;
}

function getScaleFactor(designHeight){
  //original design was created with a 360x640 resolution so we divide by
  //640 to get an adjusted unit size
  var scale = windowHeight / designHeight;
  return scale;
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function createSprite(path){
  // console.log('creating sprite: resources path: '
  // + resources[path] + '   texture: ' + resources[path].texture);
  return new Sprite(
    resources[path].texture
  );
}

function addScaleXYProperties(sprite){
  if (!sprite.scaleX && sprite.scale.x) {
    Object.defineProperty(sprite, "scaleX", {
      get: function get() {
        return sprite.scale.x;
      },
      set: function set(value) {
        sprite.scale.x = value;
      }
    });
  }
  if (!sprite.scaleY && sprite.scale.y) {
    Object.defineProperty(sprite, "scaleY", {
      get: function get() {
        return sprite.scale.y;
      },
      set: function set(value) {
        sprite.scale.y = value;
      }
    });
  }
}

function rangeMapper(source, minSource, maxSource, minTarget, maxTarget, clamp){
  var sourceRange = maxSource - minSource;
  var targetRange = maxTarget - minTarget;

  var value = (source - minSource) * targetRange / sourceRange + minTarget;

  if (clamp){
    if(source >= maxSource){
      value = maxTarget;
    }

    if(source <= minSource){
      value = minTarget;
    }
  }

  return value;
}

function setDelay(func, delay){
  if(delay == undefined){
    delay = 1000;
  }
  setTimeout(function(){func();}, delay);
}

function makeBlock(width, height, padding, radius, color, shadowHeight, shadowColor){
  var block = new Container();
  block.width = width;
  block.height = height;

  var blockPaddedWidth = width - padding * 2;
  var blockPaddedHeight = height - padding * 2;

  if(shadowColor == undefined){
    var blockBase = new g;
    blockBase.beginFill(color);
    blockBase.drawRoundedRect(padding, padding,
      blockPaddedWidth, blockPaddedHeight, radius);
    block.addChild(blockBase);


  } else {
    var blockBase = new g;
    blockBase.beginFill(shadowColor);
    blockBase.drawRoundedRect(padding, padding,
      blockPaddedWidth, blockPaddedHeight, radius);
    block.addChild(blockBase);

    var blockTop = new g;
    blockTop.beginFill(color);
    blockTop.drawRoundedRect(padding, padding,
      blockPaddedWidth, blockPaddedHeight - shadowHeight, radius);
    block.addChild(blockTop);

    block.pressed = false;
    block.hideTop = () => {
      if(!block.pressed){
        blockTop.alpha = 0;
        block.pressed = true;
      } else {
        blockTop.alpha = 1;
        block.pressed = false;
      }
    }
  }

  block.isDown = false;

  return block;
}

function makeMask(width, height, padding, radius, color){

  var maskPaddedWidth = width - padding * 2;
  var maskPaddedHeight = height - padding * 2;

  var mask = new g;
  mask.beginFill(color);
  mask.drawRoundedRect(padding, padding,
    maskPaddedWidth, maskPaddedHeight, radius);

  return mask;
}

function setInteractEvents(element, start, end, move, cancel){
  element.interactive = true;

  element
    .on('mousedown', start)
    .on('touchstart',start)

    .on('touchend', end)
    .on('mouseup', end)

  if(typeof move != 'undefined'){
    element
      .on('mousemove', move)
      .on('touchmove', move);
  }

  if(typeof cancel != 'undefined'){
    element
      .on('touchendoutside', end)
      .on('mouseupoutside', end);

    console.log('made it here');
  }
}

function scaleConstants(){
  SLIDE_PAD *= sf;
  DEBUG_ACCEL_LIMIT *= sf;
  CLOCK_POS_Y *= sf;
  DATE_POS_Y *= sf;
  PADDING *= sf;
  TOUCH_SLOP *= sf;
  PERSPECTIVE_OFFSET *= sf;
}


/*
  rain layers - each can be updated from an array
  sun layers - 3 added to array, updated in loop
  fog - three layers
  wind - an array of MANY emitters that all need to be updated
  lightning - a simple random loop that will self call
  snow - 3 layers of particles
  dust?


  creating a particles layers
  speed, interval, size, opacity, color?, width emitter(for rain)?
*/

// createRain({frequency: 0.025, speed: 500, scaleStart: 0.3, scaleEnd: 0.3,
//   alphaStart: 0.8, alphaEnd: 0.5, rotation: 70, depth: 0});
// createRain({frequency: 0.02, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
//   alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
// createRain({frequency: 0.015, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
//   alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 2});
//
// createSunLight({frequency: 0.07, speed: 500, scaleStart: 0.6, scaleEnd: 0.1,
//   alphaStart: 0.8, alphaEnd: 0, depth: 0});
// createSunLight({frequency: 0.07, speed: 400, scaleStart: 1, scaleEnd: 0.2,
//   alphaStart: 0.5, alphaEnd: 0, depth: 1});
// createSunLight({frequency: 0.07, speed: 300, scaleStart: 1, scaleEnd: 0.4,
//   alphaStart: 0.4, alphaEnd: 0, depth: 2});

var weatherIteration = 0;

function getWeatherType(){
  if(state == pause){
    state = play;
  }

  checkWeather();
  clearParticleContainers();

  // weatherCode = 16; //snow
  // weatherCode = 4; //Thunderstorm
  // weatherCode = 26; //CLOUDS
  // weatherCode = 11; //rain
  // weatherCode = 24; //windy
  weatherCode = 18;

  // weatherCode = weatherIteration;
  // weatherIteration++;

  switch(weatherCode){
    case 0: //TORNADO
      createWind({duration: 2, strength: 50});
      break;
    case 1: //TOPICAL STORM wind + rain
      createWind({duration: 2, strength: 50});
      createRain({frequency: 0.02, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
      createRain({frequency: 0.015, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 2});
      break;
    case 2: //HURRICANE wind + rain + lighting
      createWind({duration: 1.5, strength: 50});
      createRain({frequency: 0.02, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
      createRain({frequency: 0.015, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 2});
      createLightning({flashDelay: 5, flashRate: 0.1});
      break;
    case 3://SEVERE THUNDERSTORMS win + rain + lighting
      createWind({duration: 1.5, strength: 50});
      createRain({frequency: 0.02, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
      createRain({frequency: 0.015, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 2});
      createLightning({flashDelay: 5, flashRate: 0.1});
      break;
    case 4:   //thunderstorms rain + lighting
      createLightning({flashDelay: 5, flashRate: 0.1});
      createRain({frequency: 0.02, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 0});
      createRain({frequency: 0.015, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 1});
      break;
    case 5:  //mixed rain and snow rain + snow
      createRain({frequency: 0.02, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 0});
      createSnow({frequency: 0.05, speed: 150, scaleStart: 0.2, scaleEnd: 0.2,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 50, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1});
      createRain({frequency: 0.015, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 2});
      break;
    case 6:  //mixed rain and sleet rain
      createRain({frequency: 0.05, speed: 500, scaleStart: 0.3, scaleEnd: 0.3,
        alphaStart: 0.8, alphaEnd: 0.5, rotation: 70, depth: 0});
      createSnow({frequency: 0.05, speed: 150, scaleStart: 0.1, scaleEnd: 0.1,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 50, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1});
      createRain({frequency: 0.02, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 2});
        break;
    case 7:  //mixed snow and sleet rain + snow
      createSnow({frequency: 0.05, speed: 250, scaleStart: 0.2, scaleEnd: 0.2,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 50, rotationMax: 80,
        rotationSpeedMax: 80, depth: 0});
      createRain({frequency: 0.02, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
      createSnow({frequency: 0.05, speed: 200, scaleStart: 0.2, scaleEnd: 0.2,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 50, rotationMax: 80,
        rotationSpeedMax: 80, depth: 2});
      break;
    case 8:   //freezing drizzle rain
    case 9:  //drizzle rain
    case 10:   //freezing rain
      createRain({frequency: 0.01, speed: 500, scaleStart: 0.12, scaleEnd: 0.12,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 0});
      createRain({frequency: 0.005, speed: 400, scaleStart: 0.06, scaleEnd: 0.06,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 1});
      break;
    case 11: //showers night
    case 12:  //showers day
      createRain({frequency: 0.05, speed: 500, scaleStart: 0.3, scaleEnd: 0.3,
        alphaStart: 0.8, alphaEnd: 0.5, rotation: 70, depth: 0});
      createRain({frequency: 0.03, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
      createRain({frequency: 0.02, speed: 300, scaleStart: 0.08, scaleEnd: 0.08,
        alphaStart: 0.5, alphaEnd: 0.4, rotation: 70, depth: 2});
      break;
    case 13:  //snow flurries
      createSnow({frequency: 0.3, speed: 140, scaleStart: 0.3, scaleEnd: 0.3,
        alphaStart: 0.8, alphaEnd: 0.5, rotationMin: 50, rotationMax: 70,
        rotationSpeedMax: 80, depth: 0.2});
      createSnow({frequency: 0.2, speed: 90, scaleStart: 0.2, scaleEnd: 0.2,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1});
      createSnow({frequency: 0.1, speed: 60, scaleStart: 0.1, scaleEnd: 0.1,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1.5});
      break;
    case 14:  //light snow showers
      createSnow({frequency: 0.2, speed: 240, scaleStart: 0.4, scaleEnd: 0.4,
        alphaStart: 0.8, alphaEnd: 0.5, rotationMin: 50, rotationMax: 70,
        rotationSpeedMax: 80, depth: 0.2});
      createSnow({frequency: 0.05, speed: 180, scaleStart: 0.2, scaleEnd: 0.2,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1});
      createSnow({frequency: 0.01, speed: 120, scaleStart: 0.1, scaleEnd: 0.1,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1.5});
      break;
    case 15:  //blowing snow
      createSnow({frequency: 0.17, speed: 460, scaleStart: 0.4, scaleEnd: 0.4,
        alphaStart: 0.8, alphaEnd: 0.5, rotationMin: 40, rotationMax: 50,
        rotationSpeedMax: 80, depth: 0.2});
      createSnow({frequency: 0.03, speed: 380, scaleStart: 0.2, scaleEnd: 0.2,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 20, rotationMax: 70,
        rotationSpeedMax: 80, depth: 1});
      createSnow({frequency: 0.007, speed: 300, scaleStart: 0.1, scaleEnd: 0.1,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 60,
        rotationSpeedMax: 80, depth: 1.5});
      createWind({duration: 3, strength: 10});
      break;
    case 16:  //snow
      createSnow({frequency: 0.17, speed: 300, scaleStart: 0.4, scaleEnd: 0.4,
        alphaStart: 0.8, alphaEnd: 0.5, rotationMin: 50, rotationMax: 70,
        rotationSpeedMax: 80, depth: 0.2});
      createSnow({frequency: 0.03, speed: 240, scaleStart: 0.2, scaleEnd: 0.2,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1});
      createSnow({frequency: 0.007, speed: 180, scaleStart: 0.1, scaleEnd: 0.1,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1.5});
      break;
    case 17: //hail
      createRain({frequency: 0.1, speed: 700, scaleStart: 0.4, scaleEnd: 0.4,
        alphaStart: 0.8, alphaEnd: 0.5, rotation: 70, depth: 1});
      // createRain({frequency: 0.03, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
      //   alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
      createSnow({frequency: 0.01, speed: 180, scaleStart: 0.1, scaleEnd: 0.1,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1.5});
      break;
    case 18:  //sleet
      createRain({frequency: 0.1, speed: 700, scaleStart: 0.4, scaleEnd: 0.4,
        alphaStart: 0.8, alphaEnd: 0.5, rotation: 70, depth: 1});
      // createRain({frequency: 0.03, speed: 400, scaleStart: 0.15, scaleEnd: 0.15,
      //   alphaStart: 0.4, alphaEnd: 0.4, rotation: 70, depth: 1});
      createSnow({frequency: 0.01, speed: 180, scaleStart: 0.05, scaleEnd: 0.05,
        alphaStart: 0.6, alphaEnd: 0.5, rotationMin: 30, rotationMax: 80,
        rotationSpeedMax: 80, depth: 1.5});
      break;
    case 19:   createRain();         break;//dust
    case 20:   createRain();         break;//foggy
    case 21:   createRain();         break;//haze
    case 22:   createRain();         break;//smokey
    case 23:   createWind(3, 40);         break;//blustery
    case 24:   //windy
      createWind({duration: 3, strength: 40});
      break;
    case 25:   createSunLight();         break;//cold
    case 26: //cloudy
      createClouds({frequency: 4, speed: 20, scaleStart: 1, scaleEnd: 1,
        alphaStart: 0.7, alphaEnd: 0.7, rotation: 0, side: 'left', depth: 1});
      createClouds({frequency: 3, speed: 40, scaleStart: 1, scaleEnd: 1,
        alphaStart: 0.3, alphaEnd: 0.3, rotation: 0, side: 'left', depth: 2});
      createClouds({frequency: 3, speed: 60, scaleStart: 1, scaleEnd: 1,
        alphaStart: 0.4, alphaEnd: 0.4, rotation: 0, side: 'left', depth: 1.5});
      break;
    case 27:   createSunLight();         break;//mostly cloudy night
    case 28:   createSunLight();         break;//mostly cloudy day
    case 29:   createSunLight();         break;//partly cloudy night
    case 30:   createSunLight();         break;//partly cloudy day
    case 31:   createSunLight();         break;//clear night
    case 32:  //sunny
      createSunLight({frequency: 0.07, speed: 500, scaleStart: 0.6, scaleEnd: 0.1,
        alphaStart: 0.8, alphaEnd: 0, depth: 0});
      createSunLight({frequency: 0.07, speed: 400, scaleStart: 1, scaleEnd: 0.2,
        alphaStart: 0.5, alphaEnd: 0, depth: 1});
      createSunLight({frequency: 0.07, speed: 300, scaleStart: 1, scaleEnd: 0.4,
        alphaStart: 0.4, alphaEnd: 0, depth: 2});
      break;
    case 33:   //fair night
      createSunLight();
      break;
    case 34:   //fair day
      createSunLight();
      break;
    case 35:   createRain();         break;//mixed rain and hail
    case 36:   createSunLight();         break;//hot
    case 37:   createRain();         break;//isolated thunderstorms
    case 38:   createRain();         break;//scattered thunderstorms night
    case 39:   createRain();         break;//scattered thunderstorms day
    case 40:   createRain();         break;//scattered showers
    case 41:   createRain();         break;//heavy snow night
    case 42:   createRain();         break;//scattered snow showers
    case 43:   createRain();         break;//heavy snow day
    case 44:   createRain();         break;//partly cloudy
    case 45:   createRain();         break;//thundershowers
    case 46:   createRain();         break;//snow showers
    case 47:   createRain();         break;//isolated thundershowers
    case 3200:   createRain();         break;//not available
  }

}

var fps = {
  startTime : 0,
  frameNumber : 0,
  getFPS : function(){
    this.frameNumber++;
    var d = new Date().getTime(),
    currentTime = ( d - this.startTime ) / 1000,
    result = Math.floor( ( this.frameNumber / currentTime ) );
    if( currentTime > 1 ){
      this.startTime = new Date().getTime();
      this.frameNumber = 0;
    }
    return result;
  }
};
