const express = require("express");
const app = express();
app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    })
);

const PORT = 4062;

const axios = require("axios");
const fs = require("fs");
const config = fs.existsSync("config-fix.js")
    ? require("./config-fix")
    : require("./config");
const { Console } = require("node:console");
const { Transform } = require("node:stream");

const ts = new Transform({
    transform(chunk, enc, cb) {
        cb(null, chunk);
    },
});
const logger = new Console({ stdout: ts });
const { tabletojson } = require("tabletojson");

function getTable(data) {
    logger.table(data);
    return (ts.read() || "").toString();
}

function getFixedTable(str) {
    let result = str.split("\n");
    const startIndex = result[1].indexOf("(ind");
    const stopIndex = result[0].indexOf("┬") + 2;
    return result
        .map((d) => d.substring(0, startIndex) + d.substring(stopIndex))
        .join("\n");
}

async function scrap(params, cookie) {
    try {
        const { pModule, pSub, pAct, niu, prodi, sem } = params || {};
        const response = await axios.get(config.url, {
            headers: {
                Cookie: `PHPSESSID=${cookie || config.cookie}`,
            },
            params: {
                pModule: pModule || config.pModule,
                pSub: pSub || config.pSub,
                pAct: pAct || config.pAct,
                niu: niu || config.niu,
                prodi: prodi || config.prodi,
                sem: sem || config.sem,
            },
        });

        const converted = tabletojson.convert(response.data);
        let result = [];
        converted[1].forEach((d) => {
            if (d["7"])
                result.push({
                    Nama: d["SKS"],
                    SKS: d["KE"],
                    Nilai: d["BOBOT"],
                    "Nilai SKS": d["7"],
                });
            else
                result.push({
                    "Total SKS": d["Nama"],
                    "Total Nilai SKS": d["KE"],
                    IPS: converted[2][0]["2"],
                    IPK: converted[2][1]["2"],
                });
        });

        const nilai = result.filter((d) => d["Nama"]);
        const sum = result.filter((d) => d["IPS"])[0];
        const mhs = {
            Nama: converted[0][0]["2"],
            NIM: converted[0][1]["2"],
            Prodi: converted[0][3]["2"],
            sum: `${converted[0][0]["2"]}\n${converted[0][1]["2"]}\n${converted[0][3]["2"]}`,
        };
        // const str = getTable(nilai);
        // const str2 = getTable(sum);
        // fs.writeFileSync("str1.txt", JSON.stringify(nilai, null, 2));
        // fs.writeFileSync("str2.txt", JSON.stringify(sum, null, 2));
        return Promise.resolve({
            mhs,
            nilai,
            sum,
        });
    } catch (error) {
        return Promise.resolve({
            error: true,
            msg: "Ada kesalahan! Pastikan url dan cookie benar!",
        });
    }
}

app.all("/", async (req, res) => {
    const sesi = req.query.sesi || req.body.sesi || req.header.sesi;
    const pModule = req.query.pModule || req.body.pModule || req.header.pModule;
    const pSub = req.query.pSub || req.body.pSub || req.header.pSub;
    const pAct = req.query.pAct || req.body.pAct || req.header.pAct;
    const niu = req.query.niu || req.body.niu || req.header.niu;
    const prodi = req.query.prodi || req.body.prodi || req.header.prodi;
    const sem = req.query.sem || req.body.sem || req.header.sem;

    const params = {
        pModule,
        pSub,
        pAct,
        niu,
        prodi,
        sem,
    };

    let result = await scrap(params, sesi);

    res.json(result);
});

app.listen(PORT, () => {
    console.log("running at http://localhost:" + PORT);
});
