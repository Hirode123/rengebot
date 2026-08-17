import renge_lines from './renge_lines.json' with { type: 'json' };

const env = {
    YAHOO_APIKEY: process.env.YAHOO_APIKEY,
    BSKY_USERNAME: process.env.BSKY_USERNAME,
    BSKY_PASSWORD: process.env.BSKY_PASSWORD
};

async function bskyOauth() {
    if (!env.BSKY_PASSWORD || !env.BSKY_USERNAME) {
        console.log('認証情報が不足しています。');
        return false;
    }

    try {
        //blueskyにログインする
        const response = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: env.BSKY_USERNAME,
                password: env.BSKY_PASSWORD
            })
        });

        if (response.status === 200) {
            const sessionData = await response.json();
            console.log('ログインに成功しました');
            return sessionData.accessJwt;
        } else {
            const errorText = await response.text();
            console.log('ログインに失敗しました');
        }
    } catch (err) {
        console.log(err);
    }
}

async function getTimeline() {
    const session = await bskyOauth();
    if (!session) {
        return false;
    }

    const response = await fetch("https://bsky.social/xrpc/app.bsky.feed.getFeed?feed=" + encodeURIComponent("at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot"),
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${session}`,
                "Content-Type": "application/json",
                "Accept-Language": "ja"
            },
        });

    const timeline = await response.json();
    await selectword(timeline, session);
}

async function selectword(timeline, session) {
    let text = null;
    while (!text) {
        text = timeline.feed[Math.floor(Math.random() * timeline.feed.length)].post.record.text;
    }
    const tokens = await getTokens(text);
    let token = null;
    for (let i = 0; i < tokens.result.tokens.length; i++) {
        const word = tokens.result.tokens[i];
        if (word[0].length < 2 || Number(word[0]) || word[0].match(/震|死|殺|病|症|害|爆|災|戦/) || word[3] !== "名詞") {
            continue;
        }
        token = word[0];
        break;
    }

    if (token === null) {
        token = "にゃんぱすー";
    } else {
        token = renge_lines[Math.floor(Math.random() * renge_lines.length)].replaceAll("${word}", token);
    }
    await post(token, session);
}

async function getTokens(query) {
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': `Yahoo AppID: ${env.YAHOO_APIKEY}`
    }
    const param = {
        id: 'nyanpass',
        jsonrpc: '2.0',
        method: 'jlp.maservice.parse',
        params: {
            q: query
        }
    }

    const response = await fetch("https://jlp.yahooapis.jp/jsonrpc", {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(param)
    });

    const result = await response.json();

    return result;
}

async function post(msg, session) {
    try {
        if (!session) {
            return false;
        }
        //投稿する
        const response = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${session}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repo: env.BSKY_USERNAME,
                collection: "app.bsky.feed.post",
                record: {
                    text: msg,
                    createdAt: new Date().toISOString()
                }
            })
        });
        return;
    } catch (err) {
        console.log(err);
        return false;
    }
}

getTimeline();
