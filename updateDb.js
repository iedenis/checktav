
const downloadCSV = function (url, dest) {
    var file = fs.createWriteStream(dest);
    return new Promise((resolve, reject) => {
        var responseSent = false;
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
            console.log(err)
            if (responseSent) return;
            responseSent = true;
            reject(err);
        });
    });
}

const updateDataBase = function () {
    let { exec } = require('child_process');
    const file_path = `${__dirname}/temp/RECHEV-NACHIM.CSV`
    fs.access(file_path, fs.constants.F_OK, (err) => {
        if (err) console.log(err);
        else {
            // let command = `./vendor/mongoimport/mongoimport --host Cluster0-shard-0/cluster0-shard-00-00-8tttz.mongodb.net:27017,cluster0-shard-00-01-8tttz.mongodb.net:27017,cluster0-shard-00-02-8tttz.mongodb.net:27017 --ssl --username ${dbun} --password ${dbp} --authenticationDatabase admin --db test --collection tavim --type csv --file ${file_path} --headerline`
            let command = `./vendor/mongoimport/mongoimport -h ds111258.mlab.com:11258 -d cars -c nechim --drop -u ${dbun} -p ${dbp} --file ${file_path} --type csv --headerline`
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
    });
}

downloadCSV('http://rishuy.mot.gov.il/download.php?f=RECHEV-NACHIM.CSV', `${__dirname}/temp/RECHEV-NACHIM.CSV`)
    .then(() => updateDataBase())
    .catch(err => console.log('error while updating the database', err))
