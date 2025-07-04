import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [tg, setTg] = useState(window.Telegram?.WebApp || {});
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [botUsername, setBotUsername] = useState('');
  const [settings, setSettings] = useState({
    dailyLimit: 105,
    rewardPerAd: 0.0004,
    referralReward: 0.01,
    dailyReward: 0.002
  });
  const [userData, setUserData] = useState({
    total_earnings: 0,
    method1_ads_watched: 0,
    method3_ads_watched: 0,
    referral_count: 0,
    referral_earnings: 0
  });
  const [dailyRewardStatus, setDailyRewardStatus] = useState({
    canClaim: false,
    nextClaimTime: null
  });
  const [status, setStatus] = useState({
    method1: '🔄 Please wait...',
    method3: '🔄 Please wait...',
    daily: 'Loading...'
  });
  const [toast, setToast] = useState({ show: false, message: '' });
  const [hcaptchaSitekey, setHcaptchaSitekey] = useState('');
  const [captchaBlockTimer, setCaptchaBlockTimer] = useState(null);
  const [onclckvdAd, setOnclckvdAd] = useState(null);
  const [taskAd, setTaskAd] = useState(null);
  const [adWatched, setAdWatched] = useState(false);

  useEffect(() => {
    tg.ready();
    tg.expand();

  /*  if (!tg.initData || tg.initData.length === 0) {
      alert("❌ Bu Web App yalnız Telegram bot üzerinden açılmalıdır.");
      window.location.href = "https://t.me/AdPayBots_bot";
    }*/

    setUser(tg.initDataUnsafe?.user);
    setUserId(tg.initDataUnsafe?.user?.id);

    initialize();
  }, []);

  const formatBalance = (amount) => parseFloat(amount || 0).toFixed(6);

  const showToast = (message, duration = 3000) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), duration);
  };

  const initializeFirstAd = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 2000;

    try {
      setStatus(prev => ({ ...prev, method1: '🔄 Initializing ad...' }));

      await new Promise(resolve => setTimeout(resolve, 1000));

      const show = await window.initCdTma({ 
        id: 6073810,
        onError: (error) => {
          console.error('Ad error:', error);
          setStatus(prev => ({ ...prev, method1: '❌ Ad error. Click to retry.' }));
        }
      });

      if (!show) throw new Error('Ad initialization returned null');

      setOnclckvdAd(show);
      setStatus(prev => ({ ...prev, method1: '🔄 Ready to watch' }));
    } catch (error) {
      console.error('Failed to initialize ad:', error);
      if (retryCount < maxRetries) {
        setStatus(prev => ({ ...prev, method1: `🔄 Retrying... (${retryCount + 1}/${maxRetries})` }));
        setTimeout(() => initializeFirstAd(retryCount + 1), retryDelay);
      } else {
        setStatus(prev => ({ ...prev, method1: '❌ Ad initialization failed. Click to retry.' }));
      }
    }
  };

  const initializeTaskAd = async () => {
    try {
      if (!window.AdsgramController) {
        console.error('Adsgram controller not found');
        return;
      }
      const ad = window.AdsgramController.init();
      setTaskAd(ad);
    } catch (error) {
      console.error('Failed to initialize task ad:', error);
    }
  };

  const showHCaptchaModal = () => {
    return new Promise((resolve, reject) => {
      if (!hcaptchaSitekey) {
        reject(new Error('hCaptcha site key not loaded'));
        return;
      }

      const modal = document.createElement('div');
      modal.id = 'hcaptchaModal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      `;
      
      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        max-width: 90%;
        min-width: 300px;
      `;
      
      content.innerHTML = `
        <h3>Security Verification</h3>
        <div id="hcaptcha-container"></div>
        <button id="hcaptcha-close" style="margin-top: 10px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);

      try {
        const widgetId = hcaptcha.render('hcaptcha-container', {
          sitekey: hcaptchaSitekey,
          callback: function(token) {
            modal.style.display = 'none';
            try {
              hcaptcha.reset(widgetId);
            } catch (e) {
              console.warn('Error resetting hCaptcha:', e);
            }
            document.body.removeChild(modal);
            resolve(token);
          },
          'error-callback': function(error) {
            console.error('hCaptcha error:', error);
            modal.style.display = 'none';
            try {
              hcaptcha.reset(widgetId);
            } catch (e) {
              console.warn('Error resetting hCaptcha:', e);
            }
            document.body.removeChild(modal);
            reject(new Error('hCaptcha verification failed'));
          },
          'expired-callback': function() {
            console.warn('hCaptcha expired');
            modal.style.display = 'none';
            document.body.removeChild(modal);
            reject(new Error('hCaptcha expired'));
          }
        });

        const closeBtn = document.getElementById('hcaptcha-close');
        if (closeBtn) {
          closeBtn.onclick = () => {
            modal.style.display = 'none';
            try {
              hcaptcha.reset(widgetId);
            } catch (e) {
              console.warn('Error resetting hCaptcha:', e);
            }
            document.body.removeChild(modal);
            reject(new Error('User cancelled verification'));
          };
        }
      } catch (error) {
        console.error('Error initializing hCaptcha:', error);
        document.body.removeChild(modal);
        reject(new Error('Failed to initialize hCaptcha'));
      }
    });
  };

  const handleCaptchaError = async (error) => {
    if (error.message?.includes('Too many incorrect attempts')) {
      const match = error.message.match(/Please wait (\d+) minutes/);
      if (match) {
        updateBlockTimer(parseInt(match[1]) * 60);
      }
      showToast('❌ Too many incorrect attempts. Please wait.');
    } else {
      showToast('❌ Invalid hCaptcha verification');
    }
  };

  const updateBlockTimer = (remainingSeconds) => {
    if (captchaBlockTimer) {
      clearInterval(captchaBlockTimer);
    }

    if (remainingSeconds > 0) {
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      showToast(`❌ Too many attempts. Try again in ${minutes}:${seconds.toString().padStart(2, '0')}`);

      const timer = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
          clearInterval(timer);
          showToast('✅ You can try again now');
        }
      }, 1000);
      setCaptchaBlockTimer(timer);
    }
  };

  const playOnclckvdAd = async () => {
    if (!onclckvdAd) {
      setStatus(prev => ({ ...prev, method1: '⚠️ Ad not ready. Click to retry.' }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, method1: '🔄 Verifying...' }));

      const hcaptchaToken = await showHCaptchaModal();
      
      setStatus(prev => ({ ...prev, method1: '🔄 Loading ad...' }));
      
      try {
        await onclckvdAd();
      } catch (adError) {
        console.error('Ad playback error:', adError);
      }
      
      const response = await fetch('/ad-watched', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': tg.initData
        },
        body: JSON.stringify({ 
          userid: userId,
          method: 1,
          hcaptchaToken: hcaptchaToken
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setUserData(prev => ({
          ...prev,
          method1_ads_watched: data.method1_ads_watched,
          method3_ads_watched: data.method3_ads_watched,
          total_earnings: data.total_earnings
        }));
        setStatus(prev => ({ ...prev, method1: `✅ Earned +${formatBalance(settings.rewardPerAd)} USD` }));
      } else {
        if (response.status === 429) {
          await handleCaptchaError(new Error(data.message));
        }
        setStatus(prev => ({ ...prev, method1: data.message || '⚠️ Error' }));
      }
    } catch (error) {
      console.error('Ad error:', error);
      if (error.message.includes('cancelled') || error.message.includes('expired')) {
        setStatus(prev => ({ ...prev, method1: '⚠️ Verification cancelled. Try again.' }));
      } else {
        setStatus(prev => ({ ...prev, method1: '❌ Error playing ad. Click to retry.' }));
      }
    }
  };

  const playMethod3Ad = async () => {
    try {
      setStatus(prev => ({ ...prev, method3: '🔄 Verifying...' }));

      const hcaptchaToken = await showHCaptchaModal();
      
      setStatus(prev => ({ ...prev, method3: '🔄 Loading ad...' }));
      const AdController = window.Adsgram.init({ blockId: "int-11033" });
      const adResult = await AdController.show();
      
      if (adResult.done) {
        const response = await fetch('/ad-watched', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': tg.initData
          },
          body: JSON.stringify({ 
            userid: userId,
            method: 3,
            hcaptchaToken: hcaptchaToken
          })
        });

        const data = await response.json();
        
        if (data.success) {
          setUserData(prev => ({
            ...prev,
            method1_ads_watched: data.method1_ads_watched,
            method3_ads_watched: data.method3_ads_watched,
            total_earnings: data.total_earnings
          }));
          setStatus(prev => ({ ...prev, method3: `✅ Earned +${formatBalance(settings.rewardPerAd)} USD` }));
        } else {
          if (response.status === 429) {
            await handleCaptchaError(new Error(data.message));
          }
          setStatus(prev => ({ ...prev, method3: data.message || '⚠️ Error' }));
        }
      } else {
        setStatus(prev => ({ ...prev, method3: '⚠️ Ad not completed' }));
      }
    } catch (error) {
      console.error('Ad error:', error);
      setStatus(prev => ({ ...prev, method3: '❌ Error playing ad' }));
    }
  };

  const copyReferralLink = () => {
    if (!botUsername) {
      showToast('⚠️ Please try again');
      return;
    }
    const link = `https://t.me/${botUsername}?start=${userId}`;
    navigator.clipboard.writeText(link)
      .then(() => showToast('✅ Link copied!'))
      .catch(() => showToast('❌ Copy failed'));
  };

  const claimDailyReward = async () => {
    if (!userId) {
      showToast("⚠️ System not ready");
      return;
    }

    try {
      setStatus(prev => ({ ...prev, daily: '🔄 Loading task...' }));

      if (!taskAd) {
        await initializeTaskAd();
      }

      if (!taskAd) {
        throw new Error('Task ad not initialized');
      }

      const adResult = await taskAd.show();
      
      if (adResult.done) {
        const hcaptchaToken = await showHCaptchaModal();
        
        setStatus(prev => ({ ...prev, daily: '🔄 Processing...' }));

        const response = await fetch('/claim-daily-reward', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': tg.initData
          },
          body: JSON.stringify({ 
            userid: userId,
            hcaptchaToken: hcaptchaToken
          })
        });

        const data = await response.json();

        if (data.success) {
          showToast(`✅ Claimed +${formatBalance(settings.dailyReward)} USD`);
          setUserData(prev => ({ ...prev, total_earnings: data.total_earnings }));
          updateDailyRewardInfo();
        } else {
          if (response.status === 429) {
            await handleCaptchaError(new Error(data.message));
          }
          setStatus(prev => ({ ...prev, daily: data.message || '⚠️ Error claiming reward' }));
        }
      } else {
        setStatus(prev => ({ ...prev, daily: '⚠️ Please complete the task first' }));
      }
    } catch (err) {
      console.error('Error claiming daily reward:', err);
      setStatus(prev => ({ ...prev, daily: '⚠️ Error claiming reward' }));
    }
  };

  const loadUserData = async () => {
    try {
      const response = await fetch(`/user-data?userid=${userId}`, {
        headers: {
          'X-Telegram-Init-Data': tg.initData
        }
      });
      const data = await response.json();

      if (data && typeof data.total_earnings !== 'undefined') {
        setUserData({
          total_earnings: data.total_earnings || 0,
          method1_ads_watched: data.method1_ads_watched || 0,
          method3_ads_watched: data.method3_ads_watched || 0,
          referral_count: data.referral_count || 0,
          referral_earnings: data.referral_earnings || 0
        });
      }
    } catch (error) {
      console.error('User data loading error:', error);
    }
  };

  const updateDailyRewardInfo = async () => {
    if (!userId) return;

    try {
      const res = await fetch(`/daily-reward-status?userid=${userId}`, {
        headers: {
          'X-Telegram-Init-Data': tg.initData
        }
      });
      const data = await res.json();
      
      setDailyRewardStatus({
        canClaim: data.canClaim,
        nextClaimTime: data.nextClaimTime
      });

      if (!data.canClaim && data.nextClaimTime) {
        const updateTimer = () => {
          const timeLeft = new Date(data.nextClaimTime).getTime() - Date.now();
          if (timeLeft <= 0) {
            updateDailyRewardInfo();
            return;
          }
          const h = Math.floor(timeLeft / (1000 * 60 * 60));
          const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
          setStatus(prev => ({ ...prev, daily: `⏳ Next reward in: ${h}h ${m}m ${s}s` }));
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
      } else if (data.canClaim) {
        setStatus(prev => ({ ...prev, daily: `🎁 Daily reward available: ${formatBalance(settings.dailyReward)} USD` }));
      }
    } catch (err) {
      console.error('Error checking daily reward status:', err);
      setStatus(prev => ({ ...prev, daily: '⚠️ Error checking reward status' }));
    }
  };

  const initialize = async () => {
    try {
      const settingsResponse = await fetch('/settings');
      const settingsData = await settingsResponse.json();
      setSettings(settingsData);
      
      const usernameResponse = await fetch('/bot-username');
      const usernameData = await usernameResponse.json();
      setBotUsername(usernameData.username);
      
      try {
        const sitekey = await fetch('/get-hcaptcha-sitekey', {
          headers: {
            'X-Telegram-Init-Data': tg.initData
          }
        }).then(res => res.json());
        setHcaptchaSitekey(sitekey.sitekey);
      } catch (error) {
        console.error('❌ Failed to load hCaptcha site key:', error);
        showToast('⚠️ Security verification unavailable');
      }
      
      if (userId) {
        await loadUserData();
        updateDailyRewardInfo();
      }

      initializeFirstAd();
      initializeTaskAd();
    } catch (error) {
      console.error('Initialization error:', error);
      showToast('⚠️ App initialization error');
    }
  };

  return (
    <div className="app">
      <div className="referral-banner">
        <h3>🎁 Invite Friends & Earn!</h3>
        <div className="referral-info">
          <div className="referral-steps">
            <div>1️⃣ Share your referral link</div>
            <div>2️⃣ Friends join through your link</div>
            <div>3️⃣ They watch their first ad</div>
            <div>4️⃣ You earn {formatBalance(settings.referralReward)} USD!</div>
          </div>
        </div>
      </div>
      
      <div className="daily-reward-card">
        <h2>🎁 Daily Reward</h2>
        <div className="daily-reward-info">{status.daily}</div>
        <button className="button" onClick={claimDailyReward}>Claim Daily Reward</button>
      </div>
      
      <div className="card">
        <h2>📺 Watch Ads - Method 1</h2>
        <div className="info">👤 {user?.first_name || 'Loading...'}</div>
        <div className="info">💰 {formatBalance(userData.total_earnings)} USD</div>
        <div className="progress-container">
          <progress value={userData.method1_ads_watched} max={settings.dailyLimit} />
          <div className="progress-label">{userData.method1_ads_watched}/{settings.dailyLimit}</div>
        </div>
        <button className="button" onClick={playOnclckvdAd}>Watch Ad</button>
        <p className="ad-note">I am human, ready to watch 😎</p>
        <div className="status">{status.method1}</div>
      </div>
      
      <div className="card">
        <h2>📺 Watch Ads - Method 2</h2>
        <div className="info">💰 {formatBalance(userData.total_earnings)} USD</div>
        <div className="progress-container">
          <progress value={userData.method3_ads_watched} max={settings.dailyLimit} />
          <div className="progress-label">{userData.method3_ads_watched}/{settings.dailyLimit}</div>
        </div>
        <button className="button" onClick={playMethod3Ad}>Watch Ad</button>
        <p className="ad-note">I am human, ready to watch 😎</p>
        <div className="status">{status.method3}</div>
      </div>
      
      <div className="card">
        <h2>👥 Referrals</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{userData.referral_count}</div>
            <div className="stat-label">Total Referrals</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatBalance(userData.referral_earnings)}</div>
            <div className="stat-label">Earnings (USD)</div>
          </div>
        </div>
        <button className="button" onClick={copyReferralLink}>Copy Referral Link</button>
      </div>
      
      {toast.show && (
        <div className="toast">{toast.message}</div>
      )}
    </div>
  );
}

export default App;
