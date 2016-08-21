Robot Roxie
-----------

This includes the source code for the Alexa Skill for handling the logic, including the game play mode as well as the python script used for processing on a Raspberry Pi.

Folder - Alexa Skill
====================

- lambda.js - this is the nodeJS script that serves as the Alexa Skill
- intentSchema.json - schema used to setup the Alexa Skill
- sampleUtterances.txt - utterances needed by the ASK (Alexa Skills Kit)

Folder - Raspberry Pi
=====================

- rotate.py - python script that polls for the messages, then processes.
- pitch.sh - bash script loaded into the boot script that is run when the Raspberry Pi starts up
