"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@heroui/react";
import { addToast } from "@/lib/toast";
import { getClientSeed, regenerateClientSeed } from "@/lib/api/fairness";

export function FairnessPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [clientSeed, setClientSeed] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getClientSeed();
        setClientSeed(data.clientSeed);
      } catch (error) {
        console.error("Error fetching client seed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRegenerateSeed = async () => {
    setIsRegenerating(true);
    try {
      const newClientSeed = await regenerateClientSeed();
      setClientSeed(newClientSeed);
      addToast({
        title: "Success",
        description: "Client seed regenerated successfully!",
        color: "success",
        variant: "flat",
      });
    } catch (error) {
      console.error("Error regenerating client seed:", error);
      addToast({
        title: "Error",
        description: "Failed to regenerate client seed. Please try again.",
        color: "danger",
        variant: "flat",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Fairness
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading fairness information...
        </p>
      </div>
    );
  }

  const verificationCode = `import crypto from 'crypto'

export const sha512 = (value: string) =>
  crypto.createHash('sha512').update(value).digest('hex')

export const combineSeeds = (clientSeed: string, serverSeed: string, nonce: number) =>
  sha512(\`\${clientSeed}:\${serverSeed}:\${nonce}\`)

export const getTicketNumber = (hash: string) => {
  const hashInt = BigInt('0x' + hash)
  const maxInt = BigInt(1_000_000)
  return Number((hashInt % maxInt) + BigInt(1))
}`;

  return (
    <div className="flex flex-col items-start gap-5 w-full">
      <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
        Fairness
      </h2>

      <div className="flex flex-col items-start gap-5 w-full">
        {/* Your Client Seed */}
        <div className="flex flex-col items-start gap-4 w-full">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
            Your Client Seed
          </span>
          <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
            This client seed works alongside the server seed and nonce to produce your random
            outcomes. Your client seed is generated automatically and stored securely. You can regenerate it anytime, but this will affect future case openings.
          </p>
          <div className="flex flex-col items-start gap-4 py-2 rounded-md w-full">
            <Input
              type="text"
              value={clientSeed || ""}
              isReadOnly
              isDisabled
              className="flex-1 bg-transparent text-sm leading-[15px] tracking-[-0.02em] font-medium text-white outline-none"
              placeholder="No client seed found"
              classNames={{
                input: "bg-transparent text-sm leading-[15px] tracking-[-0.02em] font-medium text-white outline-none",
                inputWrapper:"bg-background-sunken border border-[rgba(63,71,84,0.24)] rounded-md max-w-lg opacity-60"
              }}
            />
            <Button
              onPress={handleRegenerateSeed}
              isLoading={isRegenerating}
              className="h-9 px-5 mcPrimary rounded-full shrink-0"
            >
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                {isRegenerating ? "Regenerating..." : "Regenerate Seed"}
              </span>
            </Button>
          </div>
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-[rgba(63,71,84,0.24)]" />

        {/* Server Seed Hash */}
        <div className="flex flex-col items-start gap-4 w-full">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
            Server Seed Hash
          </span>
          <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
            This is the hashed representation of the random string that is used (in combination
            with the client seed, and a nonce) to generate a random number. The unhashed server
            seed will be revealed after each purchase in your purchase history. You can use the
            unhashed server seed to verify the fairness of the random number generator. The server
            seed is generated per case instance and will be shown when you open a case.
          </p>
          <div className="flex flex-row items-center gap-1 px-3 py-2 bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md w-full max-w-[400px]">
            <span className="flex-1 text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
              Server seed hash will be shown when you open a case
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-[rgba(63,71,84,0.24)]" />

        {/* Verify Randomness */}
        <div className="flex flex-col items-start gap-4 w-full">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
            Verify Randomness
          </span>
          <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
            To maintain transparency, we provide a set of functions that can be used to verify the
            fairness of your outcomes. You can use these functions to verify the VRF result you
            received after purchase. The server seed, client seed, and nonce used for a Case
            opening or battle can be found in your case purchase and/or battle history.
          </p>
          <div className="w-full p-3 bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md">
            <pre className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-white font-mono whitespace-pre-wrap overflow-x-auto">
              {verificationCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
