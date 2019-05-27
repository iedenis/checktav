const token = process.env.TOKEN;
const dbp = process.env.DB_PASSWORD;
const dbun = process.env.DB_USERNAME;
const Bot = require('node-telegram-bot-api');

let bot;
let myDB;
 

if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
}
else {
  bot = new Bot(token, { polling: true });
}

console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

const MongoClient = require('mongodb').MongoClient;
console.log("USERNAME: "+dbun)
const uri = `mongodb+srv://${dbun}:${dbp}@cluster0-8tttz.mongodb.net/test?retryWrites=true`;

const client = new MongoClient(uri, { useNewUrlParser: true });
client.connect((err, database) => {
  if (err) console.log(err);
  else {
    myDB = database.db("cars");
  }

})

const isNumber = (number, callback) => {
  const platePattern = /^([0-9]{2}-[0-9]{3}-[0-9]{2}|[0-9]{3}-[0-9]{2}-[0-9]{3}|[0-9]{5,8}|[0-9]{3}-[0-9]{3})$/
  //console.log(platePattern.test(number))
  if (platePattern.test(number)) { callback(null, number) }
  else callback("זה לא מספר של רכב", null);
}

bot.on('message', (msg) => {
  const number = msg.text;
  let reply;
  isNumber(number, function (err, number) {
    if (err) bot.sendMessage(msg.chat.id, err).catch(err => console.log(err))
    else {
      const collection = myDB.collection('tavim')
      const retval = collection.findOne({ "MISPAR RECHEV": number }).then(function (result) {
        if (result) reply = `לרכב ${number} *יש* תו חניה נכה`
        else reply = `לרכב ${number} *אין* תו חניה נכה`
        bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' })
      }).catch(err => console.log(err))
    }
  })
});

module.exports = bot;
