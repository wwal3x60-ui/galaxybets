import {useSearchParams} from "@solidjs/router";

function RewardsBanner(props) {
  const [params, setParams] = useSearchParams()

  return (
    <div
      class='rewards-banner'
      style={{
        "background-image": "url('/img/welcome-box.png')",
        "background-size": "cover",
        "background-position": "center",
        border: "1px solid #9d4edd",
        "border-radius": "12px",
        display: "flex",
        "justify-content": "space-between",
        "align-items": "center",
        padding: "20px",
        "min-height": "160px",
      }}
    >
      <div class='welcome-info'>
        <span class='welcome-label'>Welcome back,</span>
        <span class='welcome-name'>{props?.user?.username || 'Player'}</span>
        <div class='level-progress'>
          <span class='level-box'>1</span>
          <div class='progress-track'/>
          <span class='level-box'>2</span>
        </div>
      </div>

      <div class='rewards-actions'>
        <span class='rewards-count'>🎁 0 REWARDS</span>
        <button
          type='button'
          class='claim-button'
          onClick={() => setParams({modal: props?.user ? 'rakeback' : 'login'})}
        >CLAIM</button>
      </div>

      <style jsx>{`
        .welcome-info, .rewards-actions {
          display: flex;
          flex-direction: column;
        }

        .welcome-label {
          color: #fff;
          font-size: 20px;
        }

        .welcome-name {
          color: #c77dff;
          font-size: 28px;
          font-weight: bold;
        }

        .level-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }

        .level-box {
          padding: 4px 10px;
          border-radius: 4px;
          color: #fff;
          background: #9d4edd;
        }

        .progress-track {
          width: 100px;
          height: 8px;
          border-radius: 4px;
          background: #fff;
        }

        .rewards-actions {
          align-items: center;
        }

        .rewards-count {
          color: #fff;
          font-size: 14px;
          font-weight: bold;
        }

        .claim-button {
          margin-top: 10px;
          padding: 8px 30px;
          border: 1px solid #9d4edd;
          border-radius: 8px;
          color: #fff;
          background: transparent;
          font-weight: bold;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default RewardsBanner;
