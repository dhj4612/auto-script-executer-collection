const {Builder, By} = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome');
const chromeDriver = require('chromedriver');

(async function start() {
    console.log(`开始执行签到 当前执行平台=${process.platform}`)
    console.log('chrome驱动路径=', chromeDriver.path)

    let Cookie = process.env.COOKIE;
    if (!Cookie) {
        console.log('Cookie未配置')
        return
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
        let signedBtn = await driver.findElements(By.css('.signedin.btn'))
        if (signedBtn.length > 0) {
            console.log('今日已签到...')
            return
        }
        const signBtn = await driver.findElement(By.css('.signin.btn'))
        console.log('签到按钮=', signBtn)

        // 完成签到
        await signBtn.click();
        console.log('点击签到按钮，等待签到完成...');

        await driver.sleep(3000)

        console.log('检查签到情况...')
        await driver.navigate().refresh();
        signedBtn = await driver.findElements(By.css('.signedin.btn'))
        if (signedBtn.length > 0) {
            console.log('签到完成...')
        } else {
            console.log('再次尝试签到')
            signBtn.click()
            console.log('点击签到按钮，等待签到完成...');
            await driver.sleep(3000)
            signedBtn = await driver.findElements(By.css('.signedin.btn'))
            if (!signedBtn.length) {
                console.log('签到失败')
            }
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