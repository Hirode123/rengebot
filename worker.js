const rss_url = "https://rss.itmedia.co.jp/rss/2.0/netlab.xml";
const api_url = "https://jlp.yahooapis.jp/jsonrpc";

let app_id = null;
let bsky_username = null;
let bsky_pass = null;
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
    "${word}に元気を与えるのん"
];

async function getArticles() {
    try {
        const response = await fetch(rss_url, { cache: "no-store" }); //RSSからニュース一覧を取得
        if (!response.ok) {
            throw new Error(`status:${response.status}`);
        }
        const result = await response.text();
        console.log(result);
        await getTokens(result);
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
    console.log(query);

    try {
        const headers = {
            'Content-Type': 'application/json'
        }
        const param = {
            id: 'nyanpass',
            jsonrpc: '2.0',
            method: 'jlp.maservice.parse',
            params: {
                q: query
            }
        }
        console.log(param);

        //Yahoo形態素解析から結果を取得
        const response = await fetch(`${api_url}?appid=${app_id}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(param)
        });
        if (!response.ok) {
            throw new Error(`status:${response.status}`);
        }
        const result = await response.json();
        console.log(result);
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
        console.log(text)
        await post(text);//投稿する
    } catch (err) {
        console.log(err);
    }
}

function chooseWord(word) {
    console.log(word);
    if (!word[0]) {
        return false; //存在しない場合はfalseを返す
    }
    if (word[0].length < 2 || Number(word[0]) || word[0].match(/地震|災害|死|殺|津波|災|テロ|爆|暴力|性|がん|病|戦|事故|襲/) || word[3] !== "名詞") {//短すぎるorアレな言葉or名詞じゃない場合はfalseを返す
        return false;
    } else {
        return true;
    }
}

async function bskyOauth() {
    if (!bsky_pass || !bsky_username) {
        console.log('認証情報が不足しています。');
        return false;
    }

    try {
        //blueskyにログインする
        const response = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: bsky_username,
                password: bsky_pass
            })
        });

        if (response.status === 200) {
            const sessionData = await response.json();
            console.log('ログインに成功しました');
            return sessionData.accessJwt;
        } else {
            throw new Error('ログインに失敗しました');
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
                repo: bsky_username,
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

export default {
    async fetch(request, env, ctx) {
        return new Response("nyanpasu!");
    },
    async scheduled(controller, env, ctx) {
        app_id = env.YAHOO_APIKEY;
        bsky_username = env.BSKY_USERNAME;
        bsky_pass = env.BSKY_PASSWORD;
        ctx.waitUntil(
            getArticles()
        );
    }
}
