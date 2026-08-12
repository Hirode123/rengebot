const rss_url = "https://rss.itmedia.co.jp/rss/2.0/netlab.xml";
const api_url = "https://jlp.yahooapis.jp/jsonrpc";

const renge_lines = [
    "うちも${word}好きなのん",
    "${word}！？それ、${word}なん！？",
    "うち、${word}に住んでるのん...？",
    "こいつの名前は${word}にするのん",
    "こまちゃんも一緒に${word}するん！",
    "こまちゃんも今朝の${word}観たのん？",
    "${word}ほしいのん！",
    "${word}って食べれるのん？",
    "${word}食べたいのーん",
    "うちも${word}食べてみたいん！",
    "うちは${word}が熱いと思いますん！",
    "${word}見つけたーん",
    "${word}も罪なん...",
    "${word}をナメてもらったら困りますん！",
    "ほたるんも${word}するのん？",
    "${word}に元気を与えるのん",
    "うち、${word}に勝ちたいん！",
    "${word}に勝ったのん！",
    "${word}に負けましたん...",
    "${word}とは永遠のライバルなん...",
    "${word}がいっぱいなーん"
];

const env = {
    YAHOO_APIKEY: process.env.YAHOO_APIKEY,
    BSKY_USERNAME: process.env.BSKY_USERNAME,
    BSKY_PASSWORD: process.env.BSKY_PASSWORD
};

async function getArticles() {
    try {
        const response = await fetch(rss_url, { cache: "no-store" }); //RSSからニュース一覧を取得
        if (!response.ok) {
            throw new Error(`status:${response.status}`);
        }
        const result = await response.text();
        await getTokens(result, env);
    } catch (err) {
        console.log(err);
    }
}

async function getTokens(xml) {
    const titles = xml.match(/<title>.*?<\/title>/g); //正規表現でタイトルを抽出
    if (titles.length < 1) { //RSSがからの場合は戻る
        return;
    }
    const query = titles[1 + Math.floor(Math.random() * (titles.length - 1))].replace('<title>', '').replace('</title>', '');//タイトル全文を取得

    try {
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

        //Yahoo形態素解析から結果を取得
        const response = await fetch(api_url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(param)
        });
        if (!response.ok) {
            throw new Error(`status:${response.status}, APIKEY:${env.YAHOO_APIKEY}, query:${query}`);
        }
        const result = await response.json();
        let token = null;
        //条件に合うまでランダムに単語を選ぶ。300回やって見つからなかったらにゃんぱすーする
        for (let i=0; i<300; i++) {
            const number = Math.floor(Math.random() * result.result.tokens.length);
            token = result.result.tokens[number];
            if (chooseWord(token)) {
                break;
            } else {
                token = null;
            }
        }
        if (token === null) {
            token = ["にゃんぱすー"];
        }

        //テンプレートと合わせて文章を作る
        const text = renge_lines[Math.floor(Math.random() * renge_lines.length)].replaceAll("${word}", token[0]);
        await post(text);//投稿する
    } catch (err) {
        console.log(err);
    }
}

function chooseWord(word) {
    if (!word[0]) {
        return false; //存在しない場合はfalseを返す
    }
    if (word[0].length < 2 || Number(word[0]) || word[0].match(/震|死|殺|津波|災|テロ|爆|暴力|性|がん|病|戦|事故|襲/) || word[3] !== "名詞") {//短すぎるorアレな言葉or名詞じゃない場合はfalseを返す
        return false;
    } else {
        return true;
    }
}

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
            console.log('ログインに失敗しました', env.BSKY_USERNAME, env.BSKY_PASSWORD, response.status, errorText);
        }
    } catch (err) {
        console.log(err);
    }
}

async function post(msg) {
    try {
        const session = await bskyOauth();
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

getArticles();
