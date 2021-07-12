import express from 'express';
const puppeteer = require('puppeteer');
const app = express();
const port = 8080;

const serialize = function (obj: any) {
    var str = [];
    for (var p in obj)
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
        }
    return str.join('&');
};

async function run() {
    const browser = await puppeteer.launch();

    console.log('Pupeteer launched');

    app.set('view engine', 'ejs');

    app.get('/', function (req, res) {
        let { lang } = req.query;

        // Only allow a few languages
        if (['fr'].indexOf(<string>lang) < 0)
            return res.end('Invalid language used in the query');

        res.render('pages/index', { lang });
    });

    app.get('/build', async function (req, res) {
        const page = await browser.newPage();

        await page.goto(`http://localhost:${port}/?${serialize(req.query)}`, {
            waitUntil: 'networkidle2',
        });

        await page.pdf({
            path: './pdf/out.pdf',
            preferCSSPageSize: true,
            printBackground: true,
        });

        await page.close();

        res.end('done');
    });

    app.listen(port);
    console.log(port + ' is the magic port');
}

run();
