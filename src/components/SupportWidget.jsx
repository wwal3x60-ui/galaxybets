import {createSignal, Show} from "solid-js";

function SupportWidget() {
  const [isOpen, setIsOpen] = createSignal(false)

  return (
    <>
      <div class='support-widget'>
        <Show when={isOpen()}>
          <div class='support-panel' role='dialog' aria-modal='true' aria-labelledby='support-title'>
            <div class='panel-header'>
              <h2 id='support-title'>Live Support</h2>
              <button
                class='close-button'
                type='button'
                aria-label='Close support'
                onClick={() => setIsOpen(false)}
              >X</button>
            </div>

            <a class='support-link discord' href='https://discord.gg/eHWjaTaEU' target='_blank' rel='noopener noreferrer'>
              Join our Discord
            </a>
            <a class='support-link' href='mailto:support@galaxybets.com'>
              Email Support
            </a>
            <a class='support-link' href='/faq'>
              Read FAQ
            </a>
          </div>
        </Show>

        <button
          class='support-button'
          type='button'
          aria-label='Open live support'
          aria-expanded={isOpen()}
          onClick={() => setIsOpen(!isOpen())}
        >🎧</button>
      </div>

      <style jsx>{`
        .support-widget {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 14px;
          font-family: "Geogrotesque Wide", sans-serif;
        }

        .support-button {
          width: 60px;
          height: 60px;
          display: grid;
          place-items: center;
          border: 1px solid #c77dff;
          border-radius: 50%;
          background: #9d4edd;
          box-shadow: 0 0 18px rgba(157, 78, 221, 0.75), 0 0 32px rgba(157, 78, 221, 0.35);
          color: white;
          font-size: 27px;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .support-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 22px rgba(199, 125, 255, 0.9), 0 0 38px rgba(157, 78, 221, 0.45);
        }

        .support-panel {
          width: min(320px, calc(100vw - 40px));
          padding: 18px;
          border: 1px solid #9d4edd;
          border-radius: 12px;
          background: linear-gradient(145deg, #241039, #160a26);
          box-shadow: 0 0 24px rgba(157, 78, 221, 0.35), 0 12px 36px rgba(0, 0, 0, 0.5);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .panel-header h2 {
          margin: 0;
          color: white;
          font-size: 20px;
          font-weight: 700;
        }

        .close-button {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 6px;
          background: rgba(199, 125, 255, 0.12);
          color: #c77dff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }

        .close-button:hover {
          background: rgba(199, 125, 255, 0.24);
        }

        .support-link {
          display: block;
          margin-top: 9px;
          padding: 11px 12px;
          border: 1px solid rgba(157, 78, 221, 0.45);
          border-radius: 7px;
          background: rgba(157, 78, 221, 0.1);
          color: #eee5f7;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          transition: background-color 160ms ease, border-color 160ms ease;
        }

        .support-link:hover {
          border-color: #c77dff;
          background: rgba(157, 78, 221, 0.24);
        }

        .support-link.discord {
          border-color: #9d4edd;
          background: #9d4edd;
          color: white;
        }

        .support-link.discord:hover {
          background: #8b3dc7;
        }

        @media (max-width: 480px) {
          .support-button {
            width: 54px;
            height: 54px;
          }
        }

        @media (max-width: 768px) {
          .support-widget {
            bottom: 80px !important;
            right: 20px !important;
          }
        }
      `}</style>
    </>
  )
}

export default SupportWidget
