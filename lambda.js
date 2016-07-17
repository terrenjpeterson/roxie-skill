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
    } else if ("Story" === intentName) {
        getStory(intent, session, callback);
    } else if ("AMAZON.StartOverIntent" === intentName) {
        getWelcomeResponse(callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        getHelpResponse(callback);
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
    var cardTitle = "Welcome to Roxie";

    var speechOutput = "Hello, my name is Roxie and I'm ready to pitch you a ball. Please say " +
        "Pitch Ball and I will throw you a ball.";

    var cardOutput = "Roxie the Robot Pitcher";

    var repromptText = "Please tell me when you are ready to pitch a ball to you by saying, " +
        "Pitch Ball.";

    console.log('speech output : ' + speechOutput);

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, cardOutput, repromptText, shouldEndSession));
}

// this is the function that gets called to format the response to the user when they ask for help
function getHelpResponse(callback) {
    var sessionAttributes = {};
    var cardTitle = "Help";
    // this will be what the user hears after asking for help

    var speechOutput = "The Roxie Skill";

    // if the user still does not respond, they will be prompted with this additional information
    
    var repromptText = "Please tell me how I can help you by saying phrases like, " +
        "Pitch Ball.";

    var shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, speechOutput, repromptText, shouldEndSession));
}

// this is the function that gets called to format the response when the user is done
function handleSessionEndRequest(callback) {
    var cardTitle = "Thanks for using Roxie";
    
    var speechOutput = "Thank you for checking in with the Colonial History skill. Have a nice day!";

    // Setting this to true ends the session and exits the skill.

    var shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, speechOutput, null, shouldEndSession));
}

// This retrieves biographic information about a colonial history figure

function pitchBall(intent, session, callback) {
    var cardTitle = "Roxie the Robo Pitcher";
    var sessionAttributes = {};
    var shouldEndSession = false;

    var speechOutput = "Here comes the pitch";
    var cardOutput = "Pitch Ball";
    var repromptText = "Are you ready for another pitch, please say Pitch Ball.";
    
    console.log("Sending Message to SQS Queue");

    // create instruction for the pitcher
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
