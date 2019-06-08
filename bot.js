const token = process.env.TOKEN;
const dbp = process.env.DB_PASSWORD;
const dbun = process.env.DB_USERNAME;
const algorithmia_key = process.env.ALGORITHMIA_KEY;

const Bot = require('node-telegram-bot-api');
const algorithmia = require("algorithmia");
const algorithmia_client = algorithmia(algorithmia_key);
const fs = require('fs')
const http = require('http');

let bot;
let myDB;
//let uri;

const productionMode = process.env.NODE_ENV === 'production' ? 1 : 0

if (productionMode) {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
}
else {
  bot = new Bot(token, { polling: true });
}

//console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

const MongoClient = require('mongodb').MongoClient;

const uri = productionMode ?
  `mongodb+srv://${dbun}:${dbp}@cluster0-8tttz.mongodb.net/test?retryWrites=true` :
  'mongodb://localhost:27017/cars';

const client = new MongoClient(uri, { useNewUrlParser: true });
client.connect((err, database) => {
  if (err) console.log(err);
  else {
    myDB = database.db("cars");
  }
})

const isNumber = (number, callback) => {
  const platePattern = /^([0-9]{2}-[0-9]{3}-[0-9]{2}|[0-9]{3}-[0-9]{2}-[0-9]{3}|[0-9]{5,8}|[0-9]{3}-[0-9]{3})$/
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
              if (response.error || response.result.results.length === 0) {
                callback(0)
              }
              else {
                console.log(JSON.stringify(response));
                const output = response.result.results
                const score = output[0].score
                const plate = output[0].plate
                if (score < 0.5) callback(1)
                else {
                  callback(plate)
                }
              }
            })
        }
      })
    }
  })
}

bot.on('message', (msg) => {
  let number;
  if (msg.photo) {
    const photo = msg.photo;
    const fileId = photo[2].file_id;

    bot.downloadFile(fileId, __dirname + '/images/')
      .then(path => fileUpload(path, number => sendReply(number, msg.chat.id)))
      .catch(err => console.log(err))
  }
  else if (msg.text) {
    number = msg.text;
    sendReply(number, msg.chat.id);
  }
  else {
    bot.sendMessage(msg.chat.id, 'כדי להשתמש בבוט תזין בבקשה מספר רכב או תעלה תמונה')
  }
});

const sendReply = function (number, chat_id) {
  let reply;
  if (number == 0) {
    reply = 'לא מצליח לזהות מספר בתמונה';
    bot.sendMessage(chat_id, reply, { parse_mode: 'Markdown' })
  }
  else if (number === 1) {
    reply = 'המספר לא נראה ברור'
    bot.sendMessage(chat_id, reply, { parse_mode: 'Markdown' })
  }
  else {
    isNumber(number, function (err, number) {
      if (err) {
        bot.sendMessage(chat_id, 'לא מצליח לזהות מספר. תנסה שוב.').catch(err => console.log(err))
      }
      else {
        const collection = myDB.collection('tavim')
        const retval = collection.findOne({ "MISPAR RECHEV": number }).then(function (result) {
          let plate_pattern = number.toString();

          switch (plate_pattern.length) {
            case 6: plate_pattern = plate_pattern.slice(0, 3) + '-' + plate_pattern.slice(3); break;
            case 7: plate_pattern = plate_pattern.slice(0, 2) + '-' + plate_pattern.slice(2, 5) + '-' + plate_pattern.slice(5); break;
            case 8: plate_pattern = plate_pattern.slice(0, 3) + '-' + plate_pattern.slice(3, 5) + '-' + plate_pattern.slice(5); break;
            default: break;
          }

          if (result) reply = `✅ לרכב ${plate_pattern} *יש* תו חניה נכה `
          else reply = ` ❌ לרכב ${plate_pattern} *אין* תו חניה נכה `
          bot.sendMessage(chat_id, reply, { parse_mode: 'Markdown' })
        }).catch(err => console.log(err))
      }
    })
  }
}

const downloadCSV = function (url, dest) {
  var file = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => {
    var responseSent = false; // flag to make sure that response is sent only once.
    http.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (responseSent) return;
          responseSent = true;
          resolve();
        });
      });
    }).on('error', err => {
      if (responseSent) return;
      responseSent = true;
      reject(err);
    });
  });
}

const updateDataBase = function () {
  let { exec } = require('child_process');
  let command = `mongoimport --host Cluster0-shard-0/cluster0-shard-00-00-8tttz.mongodb.net:27017,cluster0-shard-00-01-8tttz.mongodb.net:27017,cluster0-shard-00-02-8tttz.mongodb.net:27017 --ssl --username ${dbun} --password ${dbp} --authenticationDatabase admin --db test --collection cars --type csv --file ./temp/RECHEV-NACHIM.CSV --headerline`
  //let command = `mongoimport --uri mongodb+srv://${dbun}:${dbp}@cluster0-8tttz.mongodb.net/
  //-d test -c tavim --type csv --file  ./temp/RECHEV-NACHIM.CSV --headerline`

  exec(command, (err, stdout, stderr) => {
    console.log('updating the database...')
    if (err) {
      console.log(err);
      return;
    }
    else {
      console.log(stderr);
    }
  })
}

setInterval(function () {
  downloadCSV('http://rishuy.mot.gov.il/download.php?f=RECHEV-NACHIM.CSV', './temp/RECHEV-NACHIM.CSV')
    .then(() => updateDataBase())
    .catch(err => console.log('error while downloading', err))
  // http://rishuy.mot.gov.il/download.php?f=RECHEV-NACHIM.CSV
}, 86400000); //86400000 milliseconds for 24 hours.

module.exports = bot;
