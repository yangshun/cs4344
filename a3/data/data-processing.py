#!/usr/bin/python

import sys
import csv

def read_csv(csvfilename):
    """
    Reads a csv file and returns a list of list
    containing rows in the csv file and its entries.
    """
    rows = []

    with open(csvfilename, 'rU') as csvfile:
        file_reader = csv.reader(csvfile)
        for row in file_reader:
            rows.append(row)
    return rows

def main(filename):
    data = read_csv(filename)
    data = data[1:] # Throw away header
    timestamps = {}
    for row in data:
        timestamp = int(row[0])
        event = row[1]
        if timestamp not in timestamps:
            timestamps[timestamp] = {}

        if event not in timestamps[timestamp]:
            timestamps[timestamp][event] = 0
        timestamps[timestamp][event] += 1

    output = []
    events = ['fire', 'hit', 'turn', 'join', 'new']
    cumulative = {}
    for event in events:
        cumulative[event] = 0

    unique_timestamps = timestamps.keys()
    unique_timestamps.sort()
    for timestamp in unique_timestamps:
        row = [timestamp]
        total = 0
        for event in events:
            if event in timestamps[timestamp]:
                cumulative[event] += timestamps[timestamp][event]
            total += cumulative[event]
            row.append(cumulative[event]) 
        row.append(total)

        output.append(row)

    with open(filename.split('.')[0] + '-processed.csv', 'wb') as csvfile:
        writer = csv.writer(csvfile, delimiter=',')
        header = ['timestamp', 'fire', 'hit', 'turn', 'join', 'new', 'total']
        writer.writerow(header)
        for row in output:
            writer.writerow(row)

if __name__ == '__main__':
    main(sys.argv[1])
