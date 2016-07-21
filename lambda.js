/**
 * This skill triggers a message queue that instructs a pitching machine to throw a ball
 */

var AWS = require('aws-sdk');

var sqs = new AWS.SQS({region : 'us-east-1'});

var AWS_ACCOUNT = '034353605017';
var QUEUE_NAME = 'talkWithPitcher';
var QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/';

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * This validates that the applicationId matches what is provided by Amazon.
         */
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.be12c091-892e-4c70-a548-73ba6e137ce9") {
             context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
        ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
        ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill. This drives
 * the main logic for the function.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
        ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // Dispatch to the individual skill handlers

    if ("PitchBall" === intentName) {
        pitchBall(intent, session, callback);
    } else if ("StartGame" === intentName) {
        startGame(intent, session, callback);
    } else if ("SetPlayerName" === intentName) {
        updatePlayerName(intent, session, callback);
    } else if ("BadPitch" === intentName) {
        skipPitch(intent, session, callback);
    } else if ("Strike" === intentName) {
        countPitch(intent, session, callback);
    } else if ("BaseHit" === intentName) {
        addScore(intent, session, callback);
    } else if ("AMAZON.StartOverIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        getHelpResponse(session, callback);
    } else if ("AMAZON.RepeatIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("AMAZON.StopIntent" === intentName || "AMAZON.CancelIntent" === intentName) {
        handleSessionEndRequest(callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
        ", sessionId=" + session.sessionId);
}

// --------------- Base Functions that are invoked based on standard utterances -----------------------

// this is the function that gets called to format the response to the user when they first boot the app

function getWelcomeResponse(callback) {
    var sessionAttributes = {};
    var shouldEndSession = false;
    var cardTitle = "Welcome to Robot Roxie";

    var speechOutput = "Hello, my name is Roxie and I'm a really big fan of playing baseball. If you would " +
        "like to play a game, say Start Game and I will walk you through the steps needed to play a two " +
        "player game. If you just want to practice, then please say " +
        "Pitch Ball and I will throw you a ball.";

    var cardOutput = "Roxie the Robot Pitcher";

    var repromptText = "Please tell me when you are ready to pitch a ball to you by saying, " +
        "Pitch Ball or begin a game by saying Start Game.";

    console.log('speech output : ' + speechOutput);

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, cardOutput, repromptText, shouldEndSession));
}

// this is the function that gets called to format the response to the user when they ask for help
function getHelpResponse(session, callback) {
    var sessionAttributes = {};
    var cardTitle = "Robot Roxie Help";
    // this will be what the user hears after asking for help

    // first check if a session exists, if so save so it won't be lost
    if (session.attributes) {
        sessionAttributes = session.attributes;
    }

    var speechOutput = "There are two modes for Robot Roxie. One is a general practice mode where " +
        "all you need to do is say Pitch Ball and I will interact by recording a pitch. There is " +
        "also a game mode that begins by saying Start Game. I will then coordinate a two player " +
        "game where each will take sides and have turns having balls pitched to them. After each " +
        "pitch I will ask for a response on what the outcome is, either strike, ball, or hit.";

    // if the user still does not respond, they will be prompted with this additional information
    
    var repromptText = "Please tell me how I can help you by saying phrases like, " +
        "Pitch Ball or Start Game.";

    var shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));
}

// this is the function that gets called to format the response when the user is done
function handleSessionEndRequest(callback) {
    var cardTitle = "Thanks for using Robot Roxie";
    
    var speechOutput = "Thank you for playing with Roxie. Have a nice day!";

    // Setting this to true ends the session and exits the skill.

    var shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, speechOutput, null, shouldEndSession));
}

// This processes logic around a pitch being thrown, including communicating to the queue

function pitchBall(intent, session, callback) {
    var cardTitle = "Roxie the Robot Pitcher";
    var sessionAttributes = {};
    var shouldEndSession = false;

    var cardOutput = "Pitch Ball";
    
    // first check if a session exists, if so assume playing a game and use, if not, assume practice mode.
    if (session.attributes) {
        sessionAttributes = session.attributes;
        // increment pitch count
        sessionAttributes.data.currPitch += 1;

        var speechOutput = {};

        // personalize voice command to match player name
        if (sessionAttributes.data.homeTeamAtBat) {
            speechOutput = sessionAttributes.data.playerTwo.name;
        } else {
            speechOutput = sessionAttributes.data.playerOne.name;
        }
        // add pitch number reminder
        speechOutput = speechOutput + ", here comes pitch number " + sessionAttributes.data.currPitch + ".";
        // set reminder in case no response is given
        var repromptText = "Please let me know if the pitch was hit or not by saying either " +
            "Bad Pitch, Strike, or Base Hit.";
    } else {
        var speechOutput = "Get ready, here comes the pitch";
        var repromptText = "When you are ready for another pitch to be thrown, please say Pitch Ball.";
    }    
    
    // create instruction for the pitcher via a message queue
    console.log("Sending Message to SQS Queue");

    var pitchRequest = {};
        pitchRequest.action = 'pitch ball';

    // package data to be sent
    var sendData = {};
        sendData.request = pitchRequest;

    // set parameters for message queue to transport data        
    var params = {
        MessageBody: JSON.stringify(sendData),
        QueueUrl: QUEUE_URL + AWS_ACCOUNT + '/' + QUEUE_NAME
    };
    
    // send message to SQS and return back message to Alexa
    sqs.sendMessage(params, function(err,data){
        if(err) {
            console.log('error:',"Fail Send Message" + err);
        } else {
            console.log('successful post - data:',data.MessageId);

            callback(sessionAttributes,
                buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));
        }
    });
}

// This processes logic around a pitch being thrown, including communicating to the queue

function startGame(intent, session, callback) {
    var cardTitle = "Roxie the Robot Pitcher";
    var sessionAttributes = {};
    var shouldEndSession = false;

    var cardOutput = "Start Game";
    
    // set initial game parameters
    var playerOne = {};
        playerOne.name = "Player One";
        playerOne.score = 0;

    var playerTwo = {};
        playerTwo.name = "Player Two";
        playerTwo.score = 0;

    var gameLength = {};
        gameLength.innings = 3;
        gameLength.pitchPerInning = 10;

    var gameParameters = {};
        gameParameters.gameMode = true;
        gameParameters.playerOne = playerOne;
        gameParameters.playerTwo = playerTwo;
        gameParameters.homeTeamAtBat = false;
        gameParameters.gameLength = gameLength;
        gameParameters.currInning = 1;
        gameParameters.currPitch = 0;
        
    var savedData = {};
        savedData.data = gameParameters;

    console.log(JSON.stringify(savedData));
        
    sessionAttributes = savedData;

    var speechOutput = "If you would like to set player names, please start by saying Set Player Name One to " +
        "then provide the player name.  For example, say Set Player Name One to Bryce.";

    var repromptText = "To set player names, please start by saying Set Player Name One to then provide the " +
        "player name. If you just want to practice, say Pitch Ball.";
    
    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));
}

// This processes setting a player name that will be used in future prompts

function updatePlayerName(intent, session, callback) {
    var cardTitle = "Update Player Name";
    var sessionAttributes = {};
    var shouldEndSession = false;
    var speechOutput = "";

    if (session.attributes && JSON.stringify(session.attributes) != "{}") {
        sessionAttributes = session.attributes;

        if (intent.slots.Name.value) {
            if (intent.slots.PlayerNum.value == 1 || intent.slots.PlayerNum.value == 2) {
                console.log("setting player name");
                speechOutput = "Player Number " + intent.slots.PlayerNum.value + " set to " + intent.slots.Name.value + ". ";
                if (intent.slots.PlayerNum.value == 1)
                    sessionAttributes.data.playerOne.name = intent.slots.Name.value;
                else
                    sessionAttributes.data.playerTwo.name = intent.slots.Name.value;
            } else
                speechOutput = "Sorry, this is a two player game so please set values to either one or two. ";
        } else {
            speechOutput = "Sorry, that name isn't valid. ";
        }
        var speechOutput = speechOutput + "If you're ready to begin playing, say Pitch Ball.";
        var repromptText = "If you're ready to begin playing, say Pitch Ball.";

    } else {
        var speechOutput = "Sorry, this feature isn't available outside of game mode. If you would like to " +
            "play a game, please say Start Game.";
        var repromptText = "If you would like to start a game and have me track game play, please say Start Game.";
    }
        
    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));
}

// This processes setting a player name that will be used in future prompts

function skipPitch(intent, session, callback) {
    var cardTitle = "Skip Pitch";
    var sessionAttributes = {};
    var shouldEndSession = false;

    if (session.attributes && JSON.stringify(session.attributes) != "{}") {
        sessionAttributes = session.attributes;
        sessionAttributes.data.currPitch -= 1; 
        var speechOutput = "We will count that one as a ball. Ready to try again? Just say Pitch Ball.";
        var repromptText = "Ready for the next pitch? If so, please say Pitch Ball.";
    } else {
        var speechOutput = "Sorry, this feature isn't available outside of game mode. If you would like to " +
            "play a game, please say Start Game.";
        var repromptText = "If you would like to start a game and have me track game play, please say Start Game.";
    }
    
    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));    
}

// This processes a strike incrementing the pitch count. Checks for ending the inning and the game are also made

function countPitch(intent, session, callback) {
    var cardTitle = "Strike Called";
    var sessionAttributes = {};
    var shouldEndSession = false;

    // first check if a session exists, if so assume playing a game and use, if not, assume practice mode.
    if (session.attributes && JSON.stringify(session.attributes) != "{}") {
        sessionAttributes = session.attributes;

        var speechOutput = "I will count pitch number " + sessionAttributes.data.currPitch + " as a strike. ";

        if (sessionAttributes.data.gameLength.pitchPerInning > sessionAttributes.data.currPitch) {
            speechOutput = speechOutput + "Ready for the next pitch? Just say Pitch Ball.";
            repromptText = "Ready for the next pitch? If so, please say Pitch Ball.";
        } else {
            if (sessionAttributes.data.homeTeamAtBat == false) {
                sessionAttributes.data.homeTeamAtBat = true;
                sessionAttributes.data.currPitch = 0;
                speechOutput = speechOutput + "Time to switch sides. It's now " + sessionAttributes.data.playerTwo.name +
                    "'s turn to hit. ";
                repromptText = "Time to switch sides. Please say Pitch Ball when ready.";
            } else {
                sessionAttributes.data.homeTeamAtBat = false;
                sessionAttributes.data.currPitch = 0;
                sessionAttributes.data.currInning += 1;
                speechOutput = speechOutput + "Time to switch sides and start inning " +
                    sessionAttributes.data.currInning + ". It's now " + sessionAttributes.data.playerOne.name +
                    "'s turn to hit. ";
                repromptText = "Time to switch sides. Please say Pitch Ball when ready.";
            }
        }
    } else {
        var speechOutput = "Sorry, this feature isn't available outside of game mode. If you would like to " +
            "play a game, please say Start Game.";
        var repromptText = "If you would like to start a game and have me track game play, please say Start Game.";
    }

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));    
}

// This processes a hit incrementing the pitch count and score. Checks for ending the inning and the game are also made.

function addScore(intent, session, callback) {
    var cardTitle = "Base hit";
    var sessionAttributes = {};
    var shouldEndSession = false;
    var repromptText = "";

    if (session.attributes && JSON.stringify(session.attributes) != "{}") {
        sessionAttributes = session.attributes;

        var speechOutput = "Nice hit! ";

        if (sessionAttributes.data.homeTeamAtBat)
            sessionAttributes.data.playerTwo.score += 1;
        else
            sessionAttributes.data.playerOne.score += 1;

        speechOutput = speechOutput + "The score is now " + 
            sessionAttributes.data.playerOne.name + " " + sessionAttributes.data.playerOne.score + " and " +
            sessionAttributes.data.playerTwo.name + " " + sessionAttributes.data.playerTwo.score + ". ";
    
        // then prepare for the next pitch checking if the inning is over
        if (sessionAttributes.data.gameLength.pitchPerInning > sessionAttributes.data.currPitch) {
            speechOutput = speechOutput + "Ready for the next pitch? Just say Pitch Ball.";
            repromptText = "Ready for the next pitch? If so, please say Pitch Ball.";
        } else {
            if (sessionAttributes.data.homeTeamAtBat == false) {
                sessionAttributes.data.homeTeamAtBat = true;
                sessionAttributes.data.currPitch = 0;
                speechOutput = speechOutput + "Time to switch sides. It's now " + sessionAttributes.data.playerTwo.name +
                    "'s turn to hit. ";
            } else {
                sessionAttributes.data.homeTeamAtBat = false;
                sessionAttributes.data.currPitch = 0;
                sessionAttributes.data.currInning += 1;
                speechOutput = speechOutput + "Time to switch sides and start inning " +
                    sessionAttributes.data.currInning + ". It's now " + sessionAttributes.data.playerOne.name +
                    "'s turn to hit. ";
            }
        }

    } else {
        var speechOutput = "Sorry, this feature isn't available outside of game mode. If you would like to " +
            "play a game, please say Start Game.";
        var repromptText = "If you would like to start a game and have me track game play, please say Start Game.";
    }

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));
}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, cardInfo, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: cardInfo
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
