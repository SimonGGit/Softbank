var fs = require("fs");

function parseDate(input : string) : Date {
    var splitted = input.split("/").map(Number);
    var date = new Date();
    date.setDate(splitted[0]);
    date.setMonth(splitted[1] - 1);
    date.setFullYear(splitted[2]);
    return date;
}

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
                public narrative : string, public amount : number) {};
    
    toString() : string {
        return "Date: " + this.date.toLocaleDateString() + ", " + this.origin.toString() + " --> " + this.to.toString() + ", Description: " + this.narrative + ", Amount: " + this.amount.toString();
    }
}

var data = fs.readFileSync("res/Transactions2014.csv", "utf8", function(err, txt) {
    //console.log(txt);
    return txt;
}).split("\n");

var transactionDict : Transaction[] = new Array();
var personDict : Person[] = new Array();

for (var i = 1; i < data.length; i++) {
     var values : string[] = data[i].split(",");
     var date : Date = parseDate(values[0]);
     if (!(values[1] in personDict)) personDict[values[1]] = new Person(values[1]);
     if (!(values[2] in personDict)) personDict[values[2]] = new Person(values[2]);
     var origin : Person = personDict[values[1]];
     var to : Person = personDict[values[2]];
     var narrative : string = values[3];
     var amount : number = parseFloat(values[4]);
     var transaction : Transaction = new Transaction(date, origin, to, narrative, amount);
     transactionDict.push(transaction);
     handleTransaction(transaction);
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
    for ( var i = 0; i < transactionDict.length; i++) {
        var transaction : Transaction = transactionDict[i];
        if (transaction.origin.name === name || transaction.to.name == name) {
            console.log(transaction.toString());
        }
    }
}

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