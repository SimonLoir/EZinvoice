import express from 'express';
import fs from 'fs';
import os from 'os';
import bodyParser from 'body-parser';
import auth from './auth';
import aws from 'aws-sdk';
import { v4 } from 'uuid';
require('dotenv').config();
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
    const tmp = os.tmpdir() + '/ezinvoices.simonloir.be/';

    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);

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
        let {
            lang,
            title,
            i_nbr,
            i_date,
            i_end_date,
            logo,
            e_name,
            e_vat,
            e_addr,
            e_email,
            e_phone_number,
            e_website,
            c_name,
            c_enterprise_name,
            c_addr,
            c_vat_number,
            data,
            due_percentage = '0',
            duration,
            struct = '',
        } = req.query;

        // Only allow a few languages
        if (['fr'].indexOf(<string>lang) < 0)
            return res.status(500).end('Invalid language used in the query');

        let str_id = i_nbr.toString();
        let str_id_len = str_id.length;
        let zeros = '0'.repeat(10 - str_id_len);
        let body = str_id + zeros;
        let end = (parseInt(body) % 97).toString();
        let struct_com =
            struct == ''
                ? body + (end == '0' ? '97' : end.length == 1 ? '0' + end : end)
                : struct;

        res.render('pages/index', {
            lang,
            title,
            i_nbr,
            i_date,
            i_end_date,
            logo,
            e_name,
            e_vat,
            e_addr,
            e_email,
            e_phone_number,
            e_website,
            c_name,
            c_enterprise_name,
            c_addr,
            c_vat_number,
            due_percentage: parseFloat(<string>due_percentage),
            data: JSON.parse(<string>data),
            duration,
            struct_com,
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
        data.data = JSON.stringify(JSON.parse(req.body.data));
        console.log(data.data);
        const url = `http://localhost:${port}/?${serialize(data)}`;
        const out = `${req.body.i_nbr}-${new Date().getTime()}-${
            req.body.token.split('.')[2]
        }.pdf`;
        console.log(url);

        // Navigates to the invoice html content
        await page.goto(url, {
            waitUntil: 'networkidle2',
        });

        // Converts the HTML to PDF
        await page.pdf({
            path: 'out/out.pdf',
            preferCSSPageSize: true,
            printBackground: true,
        });

        res.json({
            done: true,
            url: tmp + 'out',
        });

        /*const jwt_data = {
            a: req.body.i_nbr,
            d: new Date().toISOString(),
            u: v4(),
        };

        s3.upload(
            {
                Bucket: 'ezbiz',
                Key: `${req.body.e_vat}/${req.body.i_nbr}/${
                    auth.createJWT(jwt_data).token
                }/${req.body.i_nbr}.pdf`,
                Body: fs.readFileSync(tmp + out),
                ACL: 'public-read',
            },
            async (err, data) => {
                if (err) return res.json({ err });

                // Sends the download url back to the user
                res.json({
                    done: true,
                    url: data.Location,
                });
            }
        );*/

        // Closes the browser tab
        await page.close();
    });

    app.get('/exchange', async function (req, res) {
        if (!req.query.password) return res.status(500).end('Invalid password');
        res.json(auth.createJWT([true], 365 * 24 * 60 * 60));
    });

    app.use('/out', express.static('out'));

    app.listen(port);
    console.log(port + ' is the magic port');
}

run();
