import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
    CandyMachine,
    awaitTransactionSignatureConfirmation,
    getCandyMachineState,
    mintOneToken,
    shortenAddress,
} from "./candy-machine";

const ConnectButton = styled(WalletDialogButton)``;

const CounterText = styled.span``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)`
    margin: 25px;
`; // add your styles here

const float = keyframes`
    0% {
        transform: translatey(0px);
    }
    50% {
        transform: translatey(-20px);
    }
    100% {
        transform: translatey(0px);
    }           
`;

const fadeInOut = keyframes`
    0% {
        opacity: 1;
    }
    9.52% {
        opacity: 1;
    }
    14.29% {
        opacity: 0;
    }
    95.24% {
        opacity: 0;
    }
    100% {
        opacity: 1;
    }
`;

const ImgContainer = styled.div`
    height: 420px;
    width: 420px;
    position: relative;
    margin: 0 auto;
    animation: ${float} 5s ease-in-out infinite;

    @media (max-width: 1100px) {
        display: none;
    }
`;

const ImgWrap = styled.img`
    height: 420px;
    width: 420px;
    position: absolute;
    left: 0;
    animation: ${fadeInOut} 21s ease-in-out infinite;
`;

const DiscordLink = styled.img`
    height: 50px;
    filter: invert(1);
    position: absolute;
    left: 50px;
    bottom: 25px;
    transition: all 0.15s ease-in-out;
    opacity: 50%;
    &:hover {
        opacity: 100%;
    }
`;

export interface HomeProps {
    candyMachineId: anchor.web3.PublicKey;
    config: anchor.web3.PublicKey;
    connection: anchor.web3.Connection;
    startDate: number;
    treasury: anchor.web3.PublicKey;
    txTimeout: number;
}

const Home = (props: HomeProps) => {
    const [api_url, setUrl] = useState(process.env.REACT_APP_API_URL)
    const [balance, setBalance] = useState<number>();
    const [isActive, setIsActive] = useState(false); // true when countdown completes
    const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
    const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
    const [isWhitelisted, SetWhitelisted] = useState(false);

    const [itemsAvailable, setItemsAvailable] = useState(0);
    const [itemsRedeemed, setItemsRedeemed] = useState(0);
    const [itemsRemaining, setItemsRemaining] = useState(0);

    const [alertState, setAlertState] = useState<AlertState>({
        open: false,
        message: "",
        severity: undefined,
    });

    const [startDate, setStartDate] = useState(new Date(props.startDate));

    const wallet = useAnchorWallet();
    const [candyMachine, setCandyMachine] = useState<CandyMachine>();
    const refreshCandyMachineState = () => {
        (async () => {
            if (!wallet) return;

            const {
                candyMachine,
                goLiveDate,
                itemsAvailable,
                itemsRemaining,
                itemsRedeemed,
            } = await getCandyMachineState(
                wallet as anchor.Wallet,
                props.candyMachineId,
                props.connection
            );

            setItemsAvailable(itemsAvailable);
            setItemsRemaining(itemsRemaining);
            setItemsRedeemed(itemsRedeemed);

            setIsSoldOut(itemsRemaining === 0);
            setStartDate(goLiveDate);
            setCandyMachine(candyMachine);

        })();
    };

    const onMint = async () => {
        try {
            //let res = await fetch(`${api_url}/whitelisted/member/${(wallet as anchor.Wallet).publicKey.toString()}`, { method: "GET" })
            //const res_json = await res.json()
            //const res_num = await JSON.parse(JSON.stringify(res_json)).reserve //The number  of reserves the user has left
            // if (!isWhitelisted) {
            //     throw new Error("You are not whitelisted");
            // }
            // if (res_num - 1 < 0) {
            //     console.log("confirmed")
            //     throw new Error("Not enough reserves");
            // }
            setIsMinting(true);
            if (wallet && candyMachine?.program) {
                const mintTxId = await mintOneToken(
                    candyMachine,
                    props.config,
                    wallet.publicKey,
                    props.treasury
                );

                const status = await awaitTransactionSignatureConfirmation(
                    mintTxId,
                    props.txTimeout,
                    props.connection,
                    "singleGossip",
                    false
                );

                if (!status?.err) {
                    setAlertState({
                        open: true,
                        message: "Congratulations! Mint succeeded!",
                        severity: "success",
                    });
                    // const to_send = await JSON.stringify({ "reserve": res_num - 1 })
                    // await fetch(`${api_url}/whitelisted/update/${(wallet as anchor.Wallet).publicKey.toString()}/${process.env.REACT_APP_SECRET_KEY}`, {
                    //     method: "PUT",
                    //     headers: {
                    //         'Content-Type': 'application/json',
                    //     },
                    //     body: to_send
                    // })
                    // console.log("Updated Reserves for user")

                } else {
                    setAlertState({
                        open: true,
                        message: "Mint failed! Please try again!",
                        severity: "error",
                    });
                }
            }
        } catch (error: any) {
            // TODO: blech:
            let message = error.message || "Minting failed! Please try again!";
            if (!error.message) {
                if (error.message.indexOf("0x138")) {
                } else if (error.message.indexOf("0x137")) {
                    message = `SOLD OUT!`;
                } else if (error.message.indexOf("0x135")) {
                    message = `Insufficient funds to mint. Please fund your wallet.`;
                }
            } else {
                if (error.code === 311) {
                    message = `SOLD OUT!`;
                    setIsSoldOut(true);
                } else if (error.code === 312) {
                    message = `Minting period hasn't started yet.`;
                } else if (error.message === "You are not whitelisted") {
                    message = error.message;
                } else if (error.message === "Not enough reserves") {
                    message = error.message
                }
            }

            setAlertState({
                open: true,
                message,
                severity: "error",
            });
        } finally {
            if (wallet) {
                const balance = await props.connection.getBalance(wallet.publicKey);
                setBalance(balance / LAMPORTS_PER_SOL);
            }
            setIsMinting(false);
            refreshCandyMachineState();
        }
    };

    useEffect(() => {
        (async () => {
            if (wallet) {
                const balance = await props.connection.getBalance(wallet.publicKey);
                setBalance(balance / LAMPORTS_PER_SOL);
                // eslint-disable-next-line
                /* const data = await fetch(`${api_url}/whitelisted/member/${(wallet as anchor.Wallet).publicKey.toString()}`)
                // if (data.status.toString() !== "404") {
                
                //}
                else {
                    console.log("not found")
                } */
                SetWhitelisted(true);
            }
        })();
    }, [wallet, props.connection]);

    useEffect(refreshCandyMachineState, [
        wallet,
        props.candyMachineId,
        props.connection,
    ]);

    return (
        <main>

            <div style={{ fontFamily: "Gideon Roman", fontSize: "60px", margin: "25px" }}>
                SOL COAL
            </div>

            <div style={{ display: "flex" }}>

                <ImgContainer>
                    <ImgWrap src="/preview_assets/0.png" alt="Preview 1" style={{ animationDelay: "18s" }} />
                    <ImgWrap src="/preview_assets/1.png" alt="Preview 2" style={{ animationDelay: "15s" }} />
                    <ImgWrap src="/preview_assets/2.png" alt="Preview 3" style={{ animationDelay: "12s" }} />
                    <ImgWrap src="/preview_assets/3.png" alt="Preview 4" style={{ animationDelay: "9s" }} />
                    <ImgWrap src="/preview_assets/4.png" alt="Preview 5" style={{ animationDelay: "6s" }} />
                    <ImgWrap src="/preview_assets/5.png" alt="Preview 6" style={{ animationDelay: "3s" }} />
                    <ImgWrap src="/preview_assets/6.png" alt="Preview 7" style={{ animationDelay: "0s" }} />
                </ImgContainer>

                <div style={{ marginTop: "20vh", fontFamily: "Lato", fontSize: "18px", backgroundColor: "rgba(52, 52, 52, 0.9)", maxHeight: "250px", padding: "25px" }}>
                    {wallet && (
                        <p>Wallet {shortenAddress(wallet.publicKey.toBase58() || "")}</p>
                    )}

                    {wallet && <p>Balance: {(balance || 0).toLocaleString()} SOL</p>}

                    {/** 
                    {wallet && <p>Supply: {itemsAvailable}</p>}

                    {wallet && <p>Redeemed: {itemsRedeemed}</p>}
                    */}

                    {<p>Mint Price: .2 SOL</p>}
                    {wallet && <p>Minted: {itemsRedeemed} out of {itemsAvailable}</p>}
                    {wallet && <p>Remaining: {(itemsAvailable) - (itemsRedeemed)}</p>}

                    <MintContainer>
                        {!wallet ? (
                            <ConnectButton>Connect Wallet</ConnectButton>
                        ) : (
                            <MintButton
                                disabled={isSoldOut || isMinting || !isActive} //change happened here
                                onClick={onMint}
                                variant="contained"
                            >
                                {isSoldOut ? (
                                    "SOLD OUT"
                                ) : isActive ? (
                                    isMinting ? (
                                        <CircularProgress />
                                    ) : (
                                        "MINT"
                                    )
                                ) : (
                                    <Countdown
                                        date={startDate}
                                        onMount={({ completed }) => completed && setIsActive(true)}
                                        onComplete={() => setIsActive(true)}
                                        renderer={renderCounter}
                                    />
                                )}
                            </MintButton>
                        )}
                    </MintContainer>
                </div>

                <ImgContainer style={{ marginTop: "300px", left: "30px" }}>
                    <ImgWrap src="/preview_assets/7.png" alt="Preview 8" style={{ animationDelay: "18s" }} />
                    <ImgWrap src="/preview_assets/8.png" alt="Preview 9" style={{ animationDelay: "15s" }} />
                    <ImgWrap src="/preview_assets/9.png" alt="Preview 10" style={{ animationDelay: "12s" }} />
                    <ImgWrap src="/preview_assets/10.png" alt="Preview 11" style={{ animationDelay: "9s" }} />
                    <ImgWrap src="/preview_assets/11.png" alt="Preview 12" style={{ animationDelay: "6s" }} />
                    <ImgWrap src="/preview_assets/12.png" alt="Preview 13" style={{ animationDelay: "3s" }} />
                    <ImgWrap src="/preview_assets/13.png" alt="Preview 14" style={{ animationDelay: "0s" }} />
                </ImgContainer>

            </div>

            <a href="https://discord.com/invite/fU8Qv9ZvuS">
                <DiscordLink src="/discord-brands.svg" alt="SolCoal Discord Link" />
            </a>

            <Snackbar
                open={alertState.open}
                autoHideDuration={6000}
                onClose={() => setAlertState({ ...alertState, open: false })}
            >
                <Alert
                    onClose={() => setAlertState({ ...alertState, open: false })}
                    severity={alertState.severity}
                >
                    {alertState.message}
                </Alert>
            </Snackbar>
        </main>
    );
};

interface AlertState {
    open: boolean;
    message: string;
    severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
    return (
        <CounterText>
            {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
        </CounterText>
    );
};

export default Home;