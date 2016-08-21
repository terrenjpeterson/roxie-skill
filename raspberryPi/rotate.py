# import GPIO library that includes the pulse width function
import RPi.GPIO as GPIO
import time

# import json library to parse messages
import json

# import boto library that handles queuing functions
import boto.sqs

# configuration parameters
rotor_duration = 8

# connect to queue that will have incoming requests
conn = boto.sqs.connect_to_region("us-east-1")
my_queue = conn.get_queue('talkWithPitcher')

print 'queue name'
print my_queue

for i in range(1,1000):
    # check queue to see if a request exists 
    incomingMsgs = my_queue.get_messages()

    # if messages are found, process
    if len(incomingMsgs) > 0:
        for incomingMsg in incomingMsgs:
            msg = json.loads(incomingMsg.get_body())
            action = msg['request']['action']

	    # check what the requested action is
	    if action == 'pitch ball':
	        print 'pitch the ball'

        	# set parameters for IO on raspberry PI
    	        relay_pin = 12

	    	# configure IO on raspberry PI to communicate
	    	GPIO.setmode(GPIO.BOARD)
	    	GPIO.setwarnings(False)
	    	GPIO.setup(relay_pin, GPIO.OUT)

	    	print "Relay Active"

	    	GPIO.output(relay_pin, GPIO.HIGH)

	    	# pause
	    	time.sleep(rotor_duration)

	   	print "Relay Off"

	    	GPIO.output(relay_pin, GPIO.LOW)

	    	#remove message from queue
	    	my_queue.delete_message(incomingMsg)

	    	GPIO.cleanup()

    time.sleep(.1)
    print i
