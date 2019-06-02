const token = process.env.TOKEN;
const dbp = process.env.DB_PASSWORD;
const dbun = process.env.DB_USERNAME;
const algorithmia_key = process.env.ALGORITHMIA_KEY;

const Bot = require('node-telegram-bot-api');
const algorithmia = require("algorithmia");
const algorithmia_client = algorithmia(algorithmia_key);

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
const fileUpload = function (local_file_path, callback) {
  const fileName = local_file_path.split('/').pop();
  const uploadedFilePath = `data://.algo/marcemile/license_plate_recognition_ALPR/temp/${fileName}`
  const directory = algorithmia_client.dir('data://.algo/marcemile/license_plate_recognition_ALPR/temp')

  algorithmia_client.file(uploadedFilePath).exists(function (exists) {
    if (!exists) {
      directory.putFile(local_file_path, function (response) {
        if (response.error) {
          console.log('fail to upload file ' + local_file_path)
        }
        else {
          console.log(response.result);
          algorithmia.client(algorithmia_key)
            .algo("marcemile/license_plate_recognition_ALPR/0.1.1?timeout=300")
            .pipe(response.result)
            .then(function (response) {
              const output = response.result.results
              const score = output[0].score
              const plate = output[0].plate
              if (score < 0.5) console.log('cannot detect the plate number')
              else {
                callback(plate)
              }
            })
        }
      })
    }
  })

}
// data://.session/:filename// temoporary files here

bot.on('message', (msg) => {
  let number;
  if (msg.photo) {
    const photo = msg.photo;
    const fileId = photo[2].file_id;

    bot.downloadFile(fileId, __dirname + '/images/')
      .then(path => fileUpload(path, number => sendReply(number,msg.chat.id)))// has to be promise
      .catch(err => console.log(err))
  }
  else if (msg.text) {
    number = msg.text;
    console.log(msg)
    sendReply(number,msg.chat.id);

  }
  else {
    console.log('כדי להשתמש בבוט תזין בבקשה מספר רכב או תעלה תמונה')
  }
});

const sendReply = function (number,chat_id) {
  let reply;
  isNumber(number, function (err, number) {
    if (err) bot.sendMessage(msg.chat.id, err).catch(err => console.log(err))
    else {
      const collection = myDB.collection('tavim')
      const retval = collection.findOne({ "MISPAR RECHEV": number }).then(function (result) {
        if (result) reply = `✅ לרכב ${number} *יש* תו חניה נכה `
        else reply = ` ❌ לרכב ${number} *אין* תו חניה נכה `
        bot.sendMessage(chat_id, reply, { parse_mode: 'Markdown' })
      }).catch(err => console.log(err))
    }
  })
}

module.exports = bot;
