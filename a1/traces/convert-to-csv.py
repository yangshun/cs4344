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

def clean(filename, outputFilename):
    data = read_csv(filename)

    with open(outputFilename, 'wb') as csvfile:
        writer = csv.writer(csvfile, delimiter=',')
        writer.writerow(['Packet Size', 'Count'])
        for row in data:
            cells = row[0].split(' ')
            writer.writerow([cells[0], cells[2]])

clean('packet-outgoing.csv', 'packet-outgoing-histogram.csv')
