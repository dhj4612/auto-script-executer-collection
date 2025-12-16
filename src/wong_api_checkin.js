let Cookie = process.env.WONG_API_COOKIE

const checkinResponse = await fetch("https://wzw.de5.net/api/user/checkin", {
    "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "cache-control": "no-store",
        "new-api-user": "5756",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Microsoft Edge\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": `${Cookie}`,
        "Referer": "https://wzw.de5.net/console/topup"
    },
    "body": null,
    "method": "POST"
});

const text = await checkinResponse.text();
console.log(`签到结果=${text}`);

const checkinQueryResponse = await fetch("https://wzw.de5.net/api/user/checkin", {
    "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "cache-control": "no-store",
        "new-api-user": "5756",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Microsoft Edge\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": `${Cookie}`,
        "Referer": "https://wzw.de5.net/console/topup"
    },
    "body": null,
    "method": "GET"
});

const queryText = await checkinQueryResponse.text()
console.log(`签到金额=${(JSON.parse(queryText)?.data?.quota / 500000).toFixed(2)}`);

const selfResponse = await fetch("https://wzw.de5.net/api/user/self", {
    "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "cache-control": "no-store",
        "new-api-user": "5756",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Microsoft Edge\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": `${Cookie}`,
        "Referer": "https://wzw.de5.net/console/topup"
    },
    "body": null,
    "method": "GET"
})
const selfResponseText = await selfResponse.text()
console.log(`当前余额=${(JSON.parse(selfResponseText)?.data?.quota / 500000).toFixed(2)}`);