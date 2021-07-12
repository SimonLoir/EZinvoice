import express from 'express';
import fs from 'fs';
import bodyParser from 'body-parser';
import auth from './auth';
const puppeteer = require('puppeteer');
const app = express();
const port = 8080;

/**
 * Serializes an object into a proper query string that can be used in a url
 **/
const serialize = function (obj: any) {
    var str = [];
    for (var p in obj)
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
        }
    return str.join('&');
};

/**
 * Async function wrapper in order to use await in top level
 */
async function run() {
    // Creates the output folder
    if (!fs.existsSync('out')) fs.mkdirSync('out');

    // Launches puppeter
    const browser = await puppeteer.launch();

    // Setting EJS as the proper view engine for express
    app.set('view engine', 'ejs');

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }));

    // parse application/json
    app.use(bodyParser.json());

    // Creates the root of the website
    app.get('/', function (req, res) {
        let { lang, title, i_nbr, i_date, i_end_date, logo } = req.query;

        // Only allow a few languages
        if (['fr'].indexOf(<string>lang) < 0)
            return res.status(500).end('Invalid language used in the query');

        res.render('pages/index', {
            lang,
            title,
            i_nbr,
            i_date,
            i_end_date,
            logo,
        });
    });

    // Creates an invoice based on the POST content
    app.post('/build', async function (req, res) {
        // Checks that the user is allowed to access the API
        if (!req.body.token || !auth.check(req.body.token).valid)
            return res.status(500).end('Invalid access token');

        // Creates a new tab in puppeteer
        const page = await browser.newPage();
        const data = { ...req.query, ...req.body };
        const url = `http://localhost:${port}/?${serialize(data)}`;
        console.log(url);

        // Navigates to the invoice html content
        await page.goto(url, {
            waitUntil: 'networkidle2',
        });

        // Converts the HTML to PDF
        await page.pdf({
            path: `./out/${new Date().getTime()}-${
                req.body.token.split('.')[2]
            }.pdf`,
            preferCSSPageSize: true,
            printBackground: true,
        });

        await page.close();

        res.end('test');
    });

    app.get('/exchange', async function (req, res) {
        if (!req.query.password) return res.status(500).end('Invalid password');
        res.json(auth.createJWT([true], 365 * 24 * 60 * 60));
    });

    app.listen(port);
    console.log(port + ' is the magic port');
}

run();
