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
    cumulative_hit = 0;
    cumulative_fire = 0;
    unique_timestamps = timestamps.keys()
    unique_timestamps.sort()
    for timestamp in unique_timestamps:
        if 'fire' in timestamps[timestamp]:
            cumulative_fire += timestamps[timestamp]['fire']
        if 'hit' in timestamps[timestamp]:
            cumulative_hit += timestamps[timestamp]['hit']
        output.append([timestamp, cumulative_hit, cumulative_fire, cumulative_hit + cumulative_fire])

    with open(filename.split('.')[0] + '-processed.csv', 'wb') as csvfile:
        writer = csv.writer(csvfile, delimiter=',')
        header = ['Time', 'Hit', 'Fire', 'Total']
        writer.writerow(header)
        for row in output:
            writer.writerow(row)

if __name__ == '__main__':
    main(sys.argv[1])
