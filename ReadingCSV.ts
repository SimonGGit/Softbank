var fs = require("fs");
var winston = require("winston");
var Table = require("easy-table");

function logTable(objArr) {
    var t = new Table();
    for (var objKey in objArr) {
        for (var propertyKey in objArr[objKey]) {
            t.cell(propertyKey, objArr[objKey][propertyKey]);
        }
        t.newRow();
    }
    console.log(t.toString());
}

function parseDate(dateInput : string) : Date {
    
    function rangeError(param : string) : void {
        var errorMsg = "while parsing '" + dateInput + "'. " + param + " number is not in the correct range. Line is ignored.";
        winston.log("error", errorMsg);
        return null;
    }
    var splitted : number[] = dateInput.split("/").map(Number);
    var now : Date = new Date();

    if (splitted.length != 3) {
        var errorMsg = "while parsing '" + dateInput + "'. The date is incorrectly formed (not of the form #/#/#). Line is ignored.";
        winston.log("error", errorMsg);
        return null;
    }

    if (splitted.some(function(n) { // check if all numbers are not NaN
        return isNaN(n); 
    })) {
        var errorMsg = "while parsing '" + dateInput + "'. Not all values are numbers. Line is ignored.";
        winston.log("error", errorMsg);
        return null;
    };

    if (splitted[0] < 1 || (splitted[1] == 2 && splitted[0] > 28) || (splitted[1] in [4, 6, 9, 11] && splitted[0] > 30) || splitted[0] > 31
           || (splitted[2] == now.getFullYear() && splitted[1] == now.getMonth() + 1 && splitted[0] > now.getDate())) { // check if date is of correct 
        rangeError("day");
    };
    if (splitted[1] < 1 || splitted[1] > 12 || (splitted[2] == now.getFullYear() && splitted[1] > now.getMonth() + 1)) { // check if month is in the correct range
        rangeError("month");
    };
    if (splitted[2] < 1901 || splitted[2] > new Date().getFullYear()) { // check if year is in the correct range
        rangeError("year");
    };

    var date = new Date();
    date.setDate(splitted[0]);
    date.setMonth(splitted[1] - 1);
    date.setFullYear(splitted[2]);
    return date;
};

function addIfNotPresent(arr : any[], item : any) : void {
    if (!(item.toString() in arr)) arr[item.toString()] = item;
}

function handleTransaction(transaction : Transaction) : void {
    personDict[transaction.origin.toString()].updateBalance(-transaction.amount);
    personDict[transaction.to.toString()].updateBalance(transaction.amount);
}

class Person {
    balance : number
    constructor(public name : string) {
        this.balance = 0;
    };

    toString() : string {
        return this.name;
    }

    getBalance() : number {
        return this.balance;
    }

    updateBalance(change : number) : void {
        this.balance += change;
        this.balance = Math.round(this.balance * 100) / 100; // to get rid of small arithmetic errors
    }
}

class Transaction {
    constructor(public date : Date, public origin : Person, public to : Person,
                public narrative : string, public amount : number, public originFile : string) {};
    
    toString() : string {
        return "Date: " + this.date.toLocaleDateString() + "\t" + this.origin.toString() + " --> " + this.to.toString()
             + "\tDescription: " + this.narrative + "\tAmount: " + this.amount.toString() + "\tOrigin File: " + this.originFile;
    }
}

function listAll() : void {
    logTable(personDict);
}

function listTransactions(name : string) {
    if (!(name in personDict)) {
        console.log("No transactions for " + name + " were found.");
        return;
    }
    console.log("The following transactions were found involving '" + name + "':");
    var transactionsPerPerson = new Array();
    for ( var i = 0; i < transactionDict.length; i++) {
        var transaction : Transaction = transactionDict[i];
        if (transaction.origin.name === name || transaction.to.name == name) {
            transactionsPerPerson.push(transaction);
        }
    }
    logTable(transactionsPerPerson);
}

function loadCSV(fileName : string) : void {
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
        var date : Date = parseDate(values[0]);
        if (date === null) continue; // skip line if error while parsing;
        if (!(values[1] in personDict)) personDict[values[1]] = new Person(values[1]);
        if (!(values[2] in personDict)) personDict[values[2]] = new Person(values[2]);
        var origin : Person = personDict[values[1]];
        var to : Person = personDict[values[2]];
        var narrative : string = values[3];
        var amount : number = parseFloat(values[4]);
        if (isNaN(amount)) {
            var errorMsg = "line number " + i + " in file '" + fileName + "': '" + values[4] + "' is not a number. Line is ignored";
            winston.log("error", errorMsg);
            continue; // skip line
        }
        var transaction : Transaction = new Transaction(date, origin, to, narrative, amount, fileName);
        transactionDict.push(transaction);
        handleTransaction(transaction);
    }
}

function loadJSON(fileName : string) : void {
    var data : string = fs.readFileSync(fileName, "utf8", function(err, txt) {
        return txt;
    });
    var objs = JSON.parse(data);
    for (var index in objs) {
        var date = new Date(objs[index].Date);
        if (date.toString() === "Invalid Date") {
            var errorMsg = "while parsing '" + objs[index].Date + "'. Line is ignored.";
            winston.log("error", errorMsg);
            continue;
        }
        var amount : number = parseFloat(objs[index].Amount);
        if (isNaN(amount)) {
            var errorMsg = "while parsing amount: '" + objs[index].Amount + "' is not a number. Line is ignored";
            winston.log("error", errorMsg);
            continue; // skip line
        }
        if (!(objs[index].FromAccount in personDict)) personDict[objs[index].FromAccount] = new Person(objs[index].FromAccount);
        if (!(objs[index].ToAccount in personDict)) personDict[objs[index].ToAccount] = new Person(objs[index].ToAccount);
        var transaction = new Transaction(date, personDict[objs[index].FromAccount], personDict[objs[index].ToAccount], objs[index].Narrative, amount, fileName)
        transactionDict.push(transaction);
        handleTransaction(transaction);
    }
}

function loadFile(filename : string) : boolean {
    if (fs.access(filename, (err) => { return err; })) { // if file does not exist (ie there is an err)
        var errorMsg = "file '" + filename + "' does not exist, operation cancelled.";
        winston.log("error", errorMsg);
        console.log("error: " + errorMsg);
        return false;
    };
    if (filename.endsWith(".csv")) loadCSV(filename);
    else if (filename.endsWith(".json")) loadJSON(filename);
    else {
        var errorMsg = "file '" + filename + "' is of an unknown format, operation cancelled.";
        winston.log("error", errorMsg);
        console.log("error: " + errorMsg);
        return false;
    }
    return true;
}

var transactionDict : Transaction[] = new Array();
var personDict = {};
var importedFiles : string[] = new Array();
winston.add(winston.transports.File, { filename: 'logFiles/errorLog.log' });
winston.remove(winston.transports.Console);




var stdin = process.stdin;
stdin.addListener("data", function(data) {
    var answer : string = data.toString().trim();
    if (answer.toLowerCase() === "listall") listAll()
    else if (answer.startsWith("listTransactions")) {
        var args = answer.split(" ");
        listTransactions(args[1] + " " + args[2]);
    } else if (answer === "q" || answer === "quit") {
        throw new Error("");
    } else if (answer.startsWith("import")) {
        var args = answer.split(" ");
        if (importedFiles.indexOf(args[1]) != -1) {
            var errorMsg = "file '" + args[1] + "' has already been imported. Operation cancelled";
            winston.log("error", errorMsg);
            console.log("error: " + errorMsg);
        } else {
            if (loadFile(args[1])) importedFiles.push(args[1]);
        }
    } else {
        console.log("Command '" + answer + "' was not found.")
    }
    process.stdout.write("> ");
});
process.stdout.write("> ");