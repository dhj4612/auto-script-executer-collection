const {Builder, By} = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome');
const chromeDriver = require('chromedriver');

(async function start() {
    console.log(`开始执行签到 当前执行平台=${process.platform}`)
    console.log('chrome驱动路径=', chromeDriver.path)

    let Cookie = process.env.COOKIE;
    if (!Cookie) {
        Cookie = '_tea_utm_cache_2608=undefined; __tea_cookie_tokens_2608=%257B%2522web_id%2522%253A%25227511637374100145698%2522%252C%2522user_unique_id%2522%253A%25227511637374100145698%2522%252C%2522timestamp%2522%253A1748939383339%257D; is_staff_user=false; csrf_session_id=5a7c1d5d6f182563cea1b1e46429f8ce; passport_csrf_token=ba4433e168d69c555ff8451f6bb5ddcb; passport_csrf_token_default=ba4433e168d69c555ff8451f6bb5ddcb; n_mh=MUyAhH9BifY1AcAqDcVGiTyBFuPvIB1RNRHhsB4g2JA; passport_auth_status=7503b935313419b7d8fbb31655f68b73%2C; passport_auth_status_ss=7503b935313419b7d8fbb31655f68b73%2C; sid_guard=d9f68049b192b78c2f792a6dd4d6ecae%7C1760944023%7C31536000%7CTue%2C+20-Oct-2026+07%3A07%3A03+GMT; uid_tt=3be0f80b7536d84c8a5f67fbe084f860; uid_tt_ss=3be0f80b7536d84c8a5f67fbe084f860; sid_tt=d9f68049b192b78c2f792a6dd4d6ecae; sessionid=d9f68049b192b78c2f792a6dd4d6ecae; sessionid_ss=d9f68049b192b78c2f792a6dd4d6ecae; session_tlb_tag=sttt%7C1%7C2faASbGSt4wveSpt1Nbsrv________-jIxWHZO_pUgJDG4gniHfJm8E0v0gyUdfkaWBDbYtsoN0%3D; sid_ucp_v1=1.0.0-KGVkYWY3YmQ4YTE5NzUwNmRmNDk4NzRhYWMxZmNlMTMyZjkwODk1N2QKFwiXktDehIzjAxCXv9fHBhiwFDgCQPEHGgJobCIgZDlmNjgwNDliMTkyYjc4YzJmNzkyYTZkZDRkNmVjYWU; ssid_ucp_v1=1.0.0-KGVkYWY3YmQ4YTE5NzUwNmRmNDk4NzRhYWMxZmNlMTMyZjkwODk1N2QKFwiXktDehIzjAxCXv9fHBhiwFDgCQPEHGgJobCIgZDlmNjgwNDliMTkyYjc4YzJmNzkyYTZkZDRkNmVjYWU'
    }

    const cookies = Cookie.split(';').map(item => {
        const [name, ...rest] = item.trim().split('=');
        return {
            name,
            value: rest.join('='),
            domain: '.juejin.cn',
            path: '/'
        }
    })
    console.log('cookies=', cookies)

    let driver;
    try {
        let options = new chrome.Options()
            .addArguments('--headless=new') // 不要旧版 --headless
            .addArguments('--no-sandbox')
            .addArguments('--disable-dev-shm-usage')
            .addArguments('--disable-gpu') // 可选，抑制 GPU 日志
            .addArguments('--disable-gpu-compositing')
            .addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')

        driver = await new Builder()
            .forBrowser("chrome")
            .setChromeService(new chrome.ServiceBuilder(chromeDriver.path))
            .setChromeOptions(options)
            .build();

        await driver.get('https://juejin.cn/');

        await driver.manage().deleteAllCookies();

        for (const cookie of cookies) {
            await driver.manage().addCookie(cookie);
        }

        await driver.get('https://juejin.cn/user/center/signin');

        await driver.navigate().refresh();

        let title = await driver.getTitle();
        console.log('当前页面:', title)

        // 等待页面状态刷新完成
        await driver.sleep(1500)

        // 查找签到或已签到按钮（class 同时包含 signin 和 btn）
        const signedBtn = await driver.findElements(By.css('.signedin.btn'))
        if (signedBtn.length > 0) {
            console.log('今日已签到...')
            return
        }
        const signBtn = await driver.findElement(By.css('.signin.btn'))
        console.log('签到按钮=', signBtn)

        // 完成签到
        await signBtn.click();
        console.log('完成签到');

        while (true) {
            await driver.sleep(3000)
        }
    } catch (e) {
        console.error('签到执行异常=', e)
        throw new Error('签到执行失败')
    } finally {
        if (driver) {
            await driver.quit()
        }
    }
}())