var fs = require("fs");
var winston = require('winston');

function parseDate(input : string) : Date {
    function rangeError(type : string) {
        var errorMsg = "while parsing '" + input + "'. " + type + " number is not in the correct range. Line is ignored.";
        winston.log("error", errorMsg);
    }
    var splitted : number[] = input.split("/").map(Number);
    var now : Date = new Date();

    if (splitted.length != 3) {
        var errorMsg = "while parsing '" + input + "'. The date is incorrectly formed (not of the form #/#/#). Line is ignored.";
        winston.log("error", errorMsg);
        return null;
    }

    if (splitted.some(function(n) { // check if all numbers are not NaN
        return isNaN(n); 
    })) {
        var errorMsg = "while parsing '" + input + "'. Not all values are numbers. Line is ignored.";
        winston.log("error", errorMsg);
        return null;
    }

    if (splitted[0] < 1 || (splitted[1] == 2 && splitted[0] > 28) || (splitted[1] in [4, 6, 9, 11] && splitted[0] > 30) || splitted[0] > 31
           || (splitted[2] == now.getFullYear() && splitted[1] == now.getMonth() + 1 && splitted[0] > now.getDate())) { // check if date is of correct 
        rangeError("day");
    }
    if (splitted[1] < 1 || splitted[1] > 12 || (splitted[2] == now.getFullYear() && splitted[1] > now.getMonth() + 1)) { // check if month is in the correct range
        rangeError("month");
    }
    if (splitted[2] < 1901 || splitted[2] > new Date().getFullYear()) { // check if year is in the correct range
        rangeError("year");
    }
    var day = splitted[0];
    var month = splitted[1] - 1;
    var year = splitted[2];
    return new Date(year, month, day);
}

function handleTransaction(transaction : Transaction) : void {
    personDict[transaction.origin.toString()].addTransaction(transaction);
    personDict[transaction.to.toString()].addTransaction(transaction);
    transactionDict.push(transaction);
}

class Person {
    balance : number
    transactionList : Transaction[];
    constructor(public name : string) {
        this.balance = 0;
        this.transactionList = new Array();
    };

    toString() : string {
        return this.name;
    }

    getBalance() : number {
        return this.balance;
    }

    addTransaction(transaction : Transaction) : void {
        this.transactionList.push(transaction);
        this.updateBalance(transaction.amount)
    }

    updateBalance(change : number) : void {
        this.balance += change;
        this.balance = Math.round(this.balance * 100) / 100; // to get rid of small arithmetic errors
    }
}

class Transaction {
    constructor(public date : Date, public origin : Person, public to : Person,
                public narrative : string, public amount : number) {};
    
    toString() : string {
        return "Date: " + this.date.toLocaleDateString() + ", " + this.origin.toString() + " --> " + this.to.toString() + ", Description: " + this.narrative + ", Amount: " + this.amount.toString();
    }
}

function listAll() : void {
    for (var key in personDict) {
        var person : Person = personDict[key];
        if (person.getBalance() < 0) {
            console.log(person.toString() + " owes a total of " + (-person.getBalance()));
        } else {
            console.log(person.toString() + " is owed a total of " + person.getBalance());
        }
    }
}

function listTransactions(name : string) {
    if (!(name in personDict)) {
        console.log("No transactions for " + name + " were found.");
        return;
    }
    console.log("The following transactions were found involving '" + name + "':");
    for (var index = 0; index < personDict[name].transactionList.length; index++) {
        var transaction : Transaction = personDict[name].transactionList[index]
        if (transaction.origin.name === name || transaction.to.name == name) {
            console.log(transaction.toString());
        }
    }
}

function loadCSV(fileName : string) {
    var data : string[] = fs.readFileSync(fileName, "utf8", function(err, txt) {
        return txt;
    }).split("\n");

    for (var i = 1; i < data.length; i++) {
        var values : string[] = data[i].split(",");
        if (values.length != 5) {
            var errorMsg = "line number " + i + " in file '" + fileName + "': the line only contains " + values.length + " columns instead of 5. Line is ignored";
            winston.log("error", errorMsg);
            continue; // skip line
        }
        var transaction = parseCSVTransaction(values);
        if (transaction === null) continue; // skip this line
        handleTransaction(transaction);
    }
}

function parseCSVTransaction(values : string[]) {
    var date : Date = parseDate(values[0]);
    if (date === null) return null; // skip line if error while parsing;
    if (!(values[1] in personDict)) personDict[values[1]] = new Person(values[1]);
    if (!(values[2] in personDict)) personDict[values[2]] = new Person(values[2]);
    var origin : Person = personDict[values[1]];
    var to : Person = personDict[values[2]];
    var narrative : string = values[3];
    var amount : number = parseFloat(values[4]);
    if (isNaN(amount)) {
        var errorMsg = "while parsing: '" + values[4] + "' is not a number. Line is ignored";
        winston.log("error", errorMsg);
        return null; // skip line
    }
    return new Transaction(date, origin, to, narrative, amount);
}



var transactionDict : Transaction[] = new Array();
var personDict = {};
winston.level = "debug"
winston.add(winston.transports.File, { filename: 'logFiles/log.txt' });
//winston.remove(winston.transports.Console);
loadCSV("res/DodgyTransactions2015.csv");




var stdin = process.stdin;
stdin.addListener("data", function(data) {
    var answer = data.toString().trim();
    if (answer === "listAll") listAll()
    else if (answer.startsWith("listTransactions")) {
        var args = answer.split(" ");
        listTransactions(args[1] + " " + args[2]);
    } else if (answer === "q" || answer === "quit") {
        throw new Error("");
    } else {
        console.log("Command '" + answer + "' was not found.")
    }
    process.stdout.write("> ");
});
process.stdout.write("> ");