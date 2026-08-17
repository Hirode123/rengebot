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
        token = tokens.result.tokens[i];
        if (token[0].length < 2 || Number(token[0]) || token[0].match(/震|死|殺|病|症|害|爆|災|戦/) || token[3] !== "名詞") {
            token = null;
            continue;
        }
    }

    if (token === null) {
        token = "にゃんぱすー";
    } else {
        token = token[0];
    }
    console.log(token, text, JSON.stringify(tokens, null, 2));
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

getTimeline();
