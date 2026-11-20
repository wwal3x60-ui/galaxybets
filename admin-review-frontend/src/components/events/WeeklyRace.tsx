"use client";

import { useState, useEffect } from "react";
import { Image, TableColumn, TableHeader, Table, TableBody, TableRow, TableCell } from "@heroui/react";
import { Button as HerouiButton } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { type EventData } from "@/lib/api/events";
import { LeaderboardRow } from "./LeaderboardRow";

interface WeeklyRaceProps {
  eventData: EventData;
}

export function WeeklyRace({ eventData }: WeeklyRaceProps) {
  const [timeRemaining, setTimeRemaining] = useState(eventData.timeRemaining);

  useEffect(() => {
    // Reset timer when eventData changes
    setTimeRemaining(eventData.timeRemaining);

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        let { days, hours, minutes, seconds } = prev;

        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        } else if (days > 0) {
          days--;
          hours = 23;
          minutes = 59;
          seconds = 59;
        }

        return { days, hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [eventData]);

  const formatTime = (value: number) => value.toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <div className="relative w-full h-[400px] bg-[#0f1013] border-b border-[rgba(63,71,84,0.24)] overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute left-0 -translate-x-1/3 top-0">
          <Image src="/assets/images/flag.png" alt="Daily Dec" width={650} height={599} className="" />
        </div>
        <div className="absolute right-0 translate-x-1/3 top-0">
          <Image src="/assets/images/flag.png" alt="Daily Dec" width={650} height={599} className="rotate-y-180" />
        </div>
        {/* Title Section */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-row items-center gap-6 z-10">
          <div className="w-0.5 h-[100px] bg-[rgba(63,71,84,0.24)] -rotate-90" />
          <h1 className="text-[40px] leading-[44px] tracking-[-0.02em] font-bold text-white">
            {eventData.title} {eventData.prizePool}
          </h1>
          <div className="w-0.5 h-[100px] bg-[rgba(63,71,84,0.24)] -rotate-90" />
        </div>

        {/* Timer Section */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 flex flex-row justify-center items-center px-5 py-3 gap-2.5 h-[41px] bg-[rgba(63,71,84,0.24)] rounded-t-[10px]">
          <span className="px-2 text-base leading-[17px] tracking-[-0.02em] font-medium text-[#6c6c71] whitespace-nowrap">
            {eventData.type === "daily-raffle" ? "Raffle" : "Race"} Draws In{" "}
            {timeRemaining.days}D {formatTime(timeRemaining.hours)}H {formatTime(timeRemaining.minutes)}M {formatTime(timeRemaining.seconds)}S
          </span>
        </div>
      </div>

      {/* Current Winner Section */}
      <div className="flex flex-col items-center w-full max-w-4xl bg-[rgba(63,71,84,0.12)]">
        {/* Current Winner Section */}
        <div className="relative flex flex-row justify-between items-center px-5 py-3 w-full max-w-4xl h-14 ">
          <div className="flex flex-row items-center gap-1 ">
            {eventData.currentWinner && (
              <>
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                  <Image
                    src={eventData.currentWinner.avatar}
                    alt={eventData.currentWinner.name}
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                  {eventData.currentWinner.name}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-row justify-center items-center px-5 py-0.5 gap-1 h-8 bg-[rgba(63,71,84,0.24)] rounded-full">
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white whitespace-nowrap">
              Trophy case
            </span>
          </div>
          {/* Tickets Count - positioned absolutely */}
          {eventData.currentWinner && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[66px] h-[17px]">
              <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                Tickets {eventData.currentWinner.tickets}
              </span>
            </div>
          )}
        </div>

        {/* About Section */}
        <div className="flex flex-row justify-between items-start px-5 py-3 gap-[261px] w-full max-w-4xl min-h-[104px]  border-t border-[rgba(63,71,84,0.24)] rounded-b-[10px]">
          <h2 className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white w-1/2">
            About the {eventData.type === "daily-raffle" ? "Daily Raffle" : eventData.type === "weekly-race" ? "Weekly Race" : "Monthly Race"}
          </h2>
          <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71] w-1/2 shrink-0">
            {eventData.description}
          </p>
        </div>
      </div>

      {/* Leaderboard Section */}
      <div className="flex flex-col items-start gap-5 w-full max-w-4xl mt-8">
        <Table
          aria-label="Leaderboard table"
          classNames={{
            base: "w-full",
            wrapper: "bg-transparent shadow-none",
            th: "bg-transparent text-[#6c6c71] text-sm leading-[15px] tracking-[-0.02em] font-medium px-2.5 py-0 h-[15px]",
            td: "bg-transparent text-white text-base leading-[17px] tracking-[-0.02em] font-medium px-2.5 py-0 h-5 border-b border-[rgba(63,71,84,0.24)]",
            tr: "border-b border-[rgba(63,71,84,0.24)]",
          }}
        >
          <TableHeader>
            <TableColumn className="w-[30px] text-center">#</TableColumn>
            <TableColumn className="w-[30%]">
              {eventData.type === "daily-raffle" ? "Raffle" : "Race"} {eventData.totalWinners} Winners
            </TableColumn>
            <TableColumn className="w-[35%] py-3">Tickets</TableColumn>
            <TableColumn className="w-[30%] text-right">Reward</TableColumn>
          </TableHeader>
          <TableBody>
            {eventData.winners.map((winner) => (
              <TableRow key={winner.id}>
                <TableCell className="text-center">
                  <span className="text-[#6c6c71]">{winner.rank}</span>
                </TableCell>
                <TableCell className="">
                  <div className="flex flex-row items-center gap-1">
                    <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                      <Image
                        src={winner.avatar}
                        alt={winner.name}
                        width={20}
                        height={20}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span>{winner.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <span>{winner.tickets}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-[#eb808b]">{winner.reward}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
