const { exec } = require('child_process');
const axios = require('axios');
const punycode = require('punycode');
const yaml = require('js-yaml');
const dns = require('dns');
const { writeFileSync } = require('fs');
const dayjs = require('dayjs');

const http = axios.create({
    baseURL: 'http://127.0.0.1:9090'
});

// 获取订阅
async function getSub(url) {
    const { data: text, headers } = await http.get(url, {
        headers: {
            "User-Agent": "NekoBox/Android/1.3.3 (Prefer ClashMeta Format)",
        },
    })

    const data = yaml.load(text)

    data.port = 7890
    data.mode = 'Global'
    data['external-controller'] = '0.0.0.0:9090'

    writeFileSync(`./config.yaml`, yaml.dump(data), `utf8`)
    return { proxies: data?.proxies, headers };
}

async function loadConfig() {
    await http.put('/configs?force=true', {
        mode: 'Global'
    })
}

async function changeNode(name) {
    await http.put('/proxies/GLOBAL', {
        name
    })
}

async function getInfo() {
    // const { data } = await http.get('http://ipinfo.io', {
    const { data } = await http.get('http://ip-api.com/json?lang=zh-CN', {
        headers: {
            'User-Agent': 'curl/7.79.1'
        },
        timeout: 1000,
        proxy: {
            host: '127.0.0.1',
            port: 7890
        }
    })
    console.log(data);
    return data;

}

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

function clearPort(port = 9090) {
    return new Promise((resolve, reject) => {
        exec(`lsof -t -i:${port} | xargs kill -9`, (error, stdout, stderr) => {
            resolve();
        });
    })
}

async function main() {
    await clearPort(9090);
    const { proxies, headers } = await getSub(
        'https://proxypool.link/clash/proxies'
    )
    console.log(headers);

    const p = exec('./mi -d .', {
        cwd: __dirname,
        stdio: 'inherit',
    }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return;
        }

        if (stderr) {
            console.error(`Error: ${stderr}`);
            return;
        }

        console.log(`Output: ${stdout}`);
        console.log(p);

    });

    await delay(2000);

    await loadConfig();

    const proxiesObj = {}
    const newProxies = []

    for (let i = 0; i < (proxies.length); i++) {
        try {
            const proxy = proxies[i];
            console.log(proxy.name);
            console.log(proxy.server);
            await changeNode(proxy.name);
            const info = await getInfo();
            await delay(200);
            const { country, city, isp } = info
            const key = `${country}-${city}-${isp}-`
            if (!proxiesObj[key]) {
                proxiesObj[key] = 1
            }
            proxy.name = key + proxiesObj[key]
            proxiesObj[key]++
            newProxies.push(proxy)
        } catch (error) {
            // console.log(error);
        }
    }
    const newConfig = {
        proxies: newProxies,
        mode: 'Global',
    }

    writeFileSync(`./res/${dayjs().format('YYYY-MM-DD')}.yaml`, yaml.dump(newConfig), 'utf8')

    p.on('close', () => {
        console.log('Process closed');
    })
    // process.kill(p.pid);
    await clearPort(9090);

    process.exit(0);
}

main();