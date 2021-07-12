import express from 'express';
import bodyParser from 'body-parser';
import auth from './auth';
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

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }));

    // parse application/json
    app.use(bodyParser.json());

    app.get('/', function (req, res) {
        let { lang, title } = req.query;

        // Only allow a few languages
        if (['fr'].indexOf(<string>lang) < 0)
            return res.status(500).end('Invalid language used in the query');

        res.render('pages/index', { lang, title });
    });

    app.post('/build', async function (req, res) {
        if (!req.body.token || !auth.check(req.body.token).valid)
            return res.status(500).end('Invalid access token');
        const page = await browser.newPage();
        const data = { ...req.query, ...req.body };
        await page.goto(`http://localhost:${port}/?${serialize(data)}`, {
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

    app.get('/exchange', async function (req, res) {
        if (!req.query.password) return res.status(500).end('Invalid password');
        res.json(auth.createJWT([true], 365 * 24 * 60 * 60));
    });

    app.listen(port);
    console.log(port + ' is the magic port');
}

run();
