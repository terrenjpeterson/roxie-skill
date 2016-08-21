#!/bin/bash
# run rotation script recursively

for i in  {1..10}
do
    echo $i
    python rotate.py
done
