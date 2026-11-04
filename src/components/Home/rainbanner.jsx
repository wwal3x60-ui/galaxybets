function RainBanner() {
  return (
    <div
      class='rain-banner'
      style={{
        "background-image": "url('/img/rain-box.png')",
        "background-size": "cover",
        "background-position": "center",
        border: "1px solid #9d4edd",
        "border-radius": "12px",
        display: "flex",
        "flex-direction": "column",
        "justify-content": "center",
        padding: "20px",
        "min-height": "160px",
      }}
    >
      <div class='rain-header'>
        <span class='rain-title'>RAIN</span>
        <div class='rain-timer'>⏱ 00:00</div>
      </div>

      <div class='rain-numbers'>
        <span>0</span>
        <span>2</span>
        <span>0</span>
        <span>0</span>
        <span>0</span>
        <span>0</span>
      </div>

      <p class='rain-footer'>TIP, WAGER &amp; PLAY TO INCREASE THE RAIN ON SITE!</p>

      <style jsx>{`
        .rain-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .rain-title {
          color: #fff;
          font-size: 36px;
          font-weight: 900;
          font-style: italic;
          text-shadow: 0 0 10px rgba(157, 78, 221, 0.8);
        }

        .rain-timer {
          padding: 5px 15px;
          border: 1px solid #9d4edd;
          border-radius: 8px;
          color: #fff;
          background: rgba(26, 11, 46, 0.8);
        }

        .rain-numbers {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }

        .rain-numbers span {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #9d4edd;
          border-radius: 8px;
          color: #fff;
          background: rgba(26, 11, 46, 0.8);
          font-size: 20px;
          font-weight: bold;
        }

        .rain-footer {
          margin: 15px 0 0;
          color: #fff;
          font-size: 11px;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}

export default RainBanner;
