import {createSignal} from "solid-js";
import {A, useSearchParams} from "@solidjs/router";
import {api, authedAPI, createNotification, fetchUser} from "../../util/api";
import {useUser} from "../../contexts/usercontextprovider";

function SignIn(props) {
    const [, setSearchParams] = useSearchParams()
    const [mode, setMode] = createSignal('login')
    const [username, setUsername] = createSignal('')
    const [email, setEmail] = createSignal('')
    const [password, setPassword] = createSignal('')
    const [confirmPassword, setConfirmPassword] = createSignal('')
    const [confirm18, setConfirm18] = createSignal(false)
    const [isSubmitting, setIsSubmitting] = createSignal(false)
    const [, {mutateUser}] = useUser()

    function close() {
        setSearchParams({modal: null})
    }

    async function handleLoginData(data) {
        if (props?.ws() && props?.ws()?.connected) {
            props?.ws().emit('auth')
        }

        let user = await fetchUser()
        mutateUser(user)

        let code = localStorage.getItem('aff')
        if (code) {
            let res = await authedAPI('/user/affiliate', 'POST', JSON.stringify({
                code: code
            }), true)

            if (res.success) {
                createNotification('success', `Successfully redeemed affiliate code ${code}.`)
            }
            localStorage.removeItem('aff')
        }

        close()
    }

    async function submit(event) {
        event.preventDefault()
        if (isSubmitting()) return

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) {
            return createNotification('error', 'Please enter a valid email address.')
        }

        if (mode() === 'register') {
            if (!/^[A-Za-z0-9_]{3,20}$/.test(username())) {
                return createNotification('error', 'Username must be 3-20 characters and contain only letters, numbers, and underscores.')
            }
            if (password().length < 10 || password().length > 72) {
                return createNotification('error', 'Password must be between 10 and 72 characters.')
            }
            if (password() !== confirmPassword()) {
                return createNotification('error', 'Passwords do not match.')
            }
            if (!confirm18()) {
                return createNotification('error', 'You must confirm that you are at least 18 and accept the Terms of Service.')
            }
        } else if (!password()) {
            return createNotification('error', 'Please enter your password.')
        }

        setIsSubmitting(true)
        try {
            const body = mode() === 'login'
                ? {email: email(), password: password()}
                : {
                    username: username(),
                    email: email(),
                    password: password(),
                    confirm18: confirm18()
                }
            const data = await api(
                mode() === 'login' ? '/auth/login' : '/auth/register',
                'POST',
                JSON.stringify(body),
                true
            )

            if (!data) {
                createNotification('error', 'There was an error processing your request. Please try again later.')
                return
            }
            if (data.error) return
            if (!data.userId) {
                createNotification('error', 'There was an error processing your request. Please try again later.')
                return
            }

            await handleLoginData(data)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <div class='modal' onClick={close}>
                <div class='signin-container' onClick={(event) => event.stopPropagation()}>
                    <p class='close bevel' onClick={close}>X</p>

                    <form class='content' onSubmit={submit}>
                        <h2>{mode() === 'login' ? 'LOGIN' : 'REGISTER'}</h2>
                        <h1>WELCOME TO <span class='gold'>GALAXYBETS</span></h1>
                        <div class='bar'/>

                        <div class='options'>
                            <button type='button' class={'bevel option ' + (mode() === 'login' ? 'active' : '')} onClick={() => setMode('login')}>LOGIN</button>
                            <button type='button' class={'bevel option ' + (mode() === 'register' ? 'active' : '')} onClick={() => setMode('register')}>REGISTER</button>
                        </div>

                        {mode() === 'register' && (
                            <>
                                <label class='label' for='signin-username'>USERNAME</label>
                                <input id='signin-username' type='text' placeholder='Enter your username' class='credentials' value={username()} onInput={(event) => setUsername(event.currentTarget.value)} minLength='3' maxLength='20' autocomplete='username' required/>
                            </>
                        )}

                        <label class='label' for='signin-email'>EMAIL</label>
                        <input id='signin-email' type='email' placeholder='Enter your email' class='credentials' value={email()} onInput={(event) => setEmail(event.currentTarget.value)} autocomplete='email' required/>

                        <label class='label' for='signin-password'>PASSWORD</label>
                        <input id='signin-password' type='password' placeholder='Enter your password' class='credentials' value={password()} onInput={(event) => setPassword(event.currentTarget.value)} minLength={mode() === 'register' ? '10' : undefined} maxLength={mode() === 'register' ? '72' : undefined} autocomplete={mode() === 'login' ? 'current-password' : 'new-password'} required/>

                        {mode() === 'register' && (
                            <>
                                <label class='label' for='signin-confirm-password'>CONFIRM PASSWORD</label>
                                <input id='signin-confirm-password' type='password' placeholder='Confirm your password' class='credentials' value={confirmPassword()} onInput={(event) => setConfirmPassword(event.currentTarget.value)} autocomplete='new-password' required/>

                                <label class='tos'>
                                    <input type='checkbox' checked={confirm18()} onChange={(event) => setConfirm18(event.currentTarget.checked)} required/>
                                    <span>I confirm I am at least 18 years old and accept the <A href='/tos' class='white bold strip' onClick={(event) => event.stopPropagation()}>Terms of Service</A></span>
                                </label>
                            </>
                        )}

                        <button class='bevel-gold signin' type='submit' disabled={isSubmitting()}>
                            {isSubmitting() ? 'PLEASE WAIT...' : mode() === 'login' ? 'LOGIN' : 'REGISTER'}
                        </button>
                    </form>

                    <div class='art'>
                        <p class='confirm'>
                            Access your GalaxyBets account to play, compete, and connect.
                        </p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .modal {
                  position: fixed;
                  inset: 0;
                  width: 100vw;
                  height: 100vh;
                  padding: 20px;
                  box-sizing: border-box;
                  background: rgba(24, 23, 47, 0.55);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  z-index: 1000;
                }

                .signin-container {
                  max-width: 930px;
                  max-height: 100%;
                  width: 100%;
                  background: #2C2952;
                  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
                  border-radius: 15px;
                  display: flex;
                  position: relative;
                  overflow: auto;
                }

                .close {
                  position: absolute;
                  top: 15px;
                  left: 15px;
                  z-index: 2;
                  width: 26px;
                  height: 26px;
                  background: #4E4A8D;
                  box-shadow: 0px -1px 0px #5F5AA7, 0px 1px 0px #272548;
                  border-radius: 3px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 700;
                  color: #ADA3EF;
                  cursor: pointer;
                }

                h1 {
                  font-family: 'Geogrotesque Wide';
                  font-weight: 700;
                  font-size: 32px;
                  color: #FFFFFF;
                  text-align: center;
                }

                .gold {
                  background: linear-gradient(53.13deg, #FF9900 54.58%, #F9AC39 69.11%);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  background-clip: text;
                }

                .content {
                  box-sizing: border-box;
                  width: 100%;
                  min-width: 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  padding: 25px 20px;
                }

                h2 {
                  font-family: 'Geogrotesque Wide';
                  font-weight: 700;
                  font-size: 22px;
                  color: #ADA3EF;
                }

                .bar {
                  width: min(386px, 100%);
                  height: 1px;
                  margin: 10px 0 20px;
                  background: linear-gradient(53.13deg, #FF9900 54.58%, #F9AC39 69.11%), linear-gradient(90deg, #7435FA 0%, #435DE8 163.22%);
                }

                .options {
                  width: min(386px, 100%);
                  display: flex;
                  gap: 12px;
                  margin-bottom: 5px;
                }

                .option {
                  flex: 1;
                  height: 34px;
                  font-family: 'Geogrotesque Wide';
                  font-weight: 700;
                  font-size: 14px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #ADA3EF;
                  cursor: pointer;
                  outline: unset;
                  border: unset;
                }

                .option.active {
                  background: conic-gradient(from 180deg at 50% 50%, #FFDC18 -0.3deg, #B17818 72.1deg, rgba(156, 99, 15, 0.611382) 139.9deg, rgba(126, 80, 12, 0.492874) 180.52deg, rgba(102, 65, 10, 0.61) 215.31deg, #B17818 288.37deg, #FFDC18 359.62deg, #FFDC18 359.7deg, #B17818 432.1deg);
                  border-radius: 3px;
                  position: relative;
                  color: #FCA31E;
                  overflow: hidden;
                  z-index: 0;
                }

                .option.active:before {
                  position: absolute;
                  content: '';
                  width: calc(100% - 2px);
                  height: calc(100% - 2px);
                  top: 1px;
                  left: 1px;
                  background: linear-gradient(0deg, rgba(255, 190, 24, 0.25), rgba(255, 190, 24, 0.25)), linear-gradient(252.77deg, #1A0E33 -27.53%, #423C7A 175.86%);
                  z-index: -1;
                }

                .label {
                  width: min(386px, 100%);
                  box-sizing: border-box;
                  font-family: 'Geogrotesque Wide';
                  font-weight: 700;
                  font-size: 14px;
                  text-align: center;
                  color: #ADA3EF;
                  margin: 14px 0 8px;
                }

                .credentials {
                  box-sizing: border-box;
                  width: min(386px, 100%);
                  height: 50px;
                  outline: unset;
                  background: #28244A;
                  border: 1px solid #3E3771;
                  border-radius: 3px;
                  padding: 0 12px;
                  font-family: 'Geogrotesque Wide';
                  font-weight: 700;
                  font-size: 13px;
                  color: #FFFFFF;
                }

                .credentials::placeholder {
                  color: #8C87C1;
                }

                .tos {
                  box-sizing: border-box;
                  width: min(386px, 100%);
                  margin: 16px 0 0;
                  display: flex;
                  align-items: flex-start;
                  gap: 8px;
                  font-family: 'Geogrotesque Wide';
                  font-size: 13px;
                  color: #ADA3EF;
                }

                .tos input {
                  margin: 3px 0 0;
                  accent-color: #FCA31E;
                }

                .signin {
                  width: 194px;
                  height: 39px;
                  margin: 24px 0 8px;
                  outline: unset;
                  border: unset;
                  font-family: 'Geogrotesque Wide';
                  font-weight: 700;
                  font-size: 14px;
                  color: #FFFFFF;
                  cursor: pointer;
                }

                .signin:disabled {
                  cursor: wait;
                  opacity: 0.7;
                }

                .art {
                  box-sizing: border-box;
                  width: 100%;
                  max-width: 368px;
                  background: radial-gradient(116.93% 83% at 51.64% 17%, rgba(252, 164, 33, 0.3) 0%, rgba(0, 0, 0, 0) 100%), linear-gradient(358.31deg, #302E5B -15.59%, #423C7A 97.03%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 25px 15px;
                }

                .confirm {
                  max-width: 290px;
                  font-family: 'Geogrotesque Wide';
                  font-weight: 400;
                  font-size: 16px;
                  color: #ADA3EF;
                  text-align: center;
                  background: linear-gradient(277.6deg, rgba(97, 89, 176, 0.15) 6.63%, rgba(67, 55, 141, 0.15) 87.07%);
                  border-radius: 7px;
                  padding: 18px;
                }

                h1, h2 {
                  margin: unset;
                }

                @media (max-width: 700px) {
                  .art {
                    display: none;
                  }
                }
            `}</style>
        </>
    )
}

export default SignIn
