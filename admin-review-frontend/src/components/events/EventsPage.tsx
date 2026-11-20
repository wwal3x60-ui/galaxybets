"use client";

import { useEffect, useState } from "react";
import { Tabs, Tab } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { type EventData, type EventType, getEventData } from "@/lib/api/events";
import { DailyRaffle } from "./DailyRaffle";
import { WeeklyRace } from "./WeeklyRace";
import { MonthlyRace } from "./MonthlyRace";

interface EventsPageProps {
  initialEventData: EventData;
}

export function EventsPage({ initialEventData }: EventsPageProps) {
  const [activeTab, setActiveTab] = useState<EventType>(initialEventData.type);
  const [eventData, setEventData] = useState<EventData>(initialEventData);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If server-side fetch failed (fallback payload), load real data client-side.
    if (initialEventData.id !== "fallback") return;
    setIsLoading(true);
    getEventData(activeTab)
      .then((d) => setEventData(d))
      .catch((error) => {
        console.error("Error fetching event data:", error);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = async (key: string | number) => {
    const tab = key as EventType;
    if (tab === activeTab) return;

    setIsLoading(true);

    try {
      const newData = await getEventData(tab);
      setActiveTab(tab);
      setEventData(newData);
    } catch (error) {
      console.error("Error fetching event data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full pt-8 pb-10 ">
      {/* Tab Navigation */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={handleTabChange}
        classNames={{
          base: "",
          cursor:"bg-tab-active-bg!",
          tabList: "gap-2 bg-transparent",
          tab: "h-9 px-3 py-0.5 gap-1 rounded-full data-[selected=true]:bg-[rgba(63,71,84,0.24)] data-[selected=true]:border data-[selected=true]:border-[rgba(63,71,84,0.24)]",
          tabContent: "",
          tabWrapper:"w-full",
          panel:"w-full"
        }}
        radius="full"
      >
        <Tab
          key="daily-raffle"
          title={
            <div className="flex flex-row items-center gap-1">
              <Icon name="ticket" className="w-5 h-5 shrink-0" isActive={activeTab === "daily-raffle"} />
              <span>Daily Raffle</span>
            </div>
          }
        >
          <DailyRaffle eventData={eventData} />
        </Tab>
        <Tab
          key="weekly-race"
          title={
            <div className="flex flex-row items-center gap-1">
              <Icon name="racing-flag" className="w-5 h-5 shrink-0" isActive={activeTab === "weekly-race"} />
              <span>Weekly Race</span>
            </div>
          }
        >
          <WeeklyRace eventData={eventData} />
        </Tab>
        <Tab
          key="monthly-race"
          title={
            <div className="flex flex-row items-center gap-1">
              <Icon name="racing-flag" className="w-5 h-5 shrink-0" isActive={activeTab === "monthly-race"} />
              <span>Monthly Race</span>
            </div>
          }
        >
          <MonthlyRace eventData={eventData} />
        </Tab>
      </Tabs>

      {isLoading && (
        <div className="text-sm text-[#6c6c71]">
          Loading...
        </div>
      )}
    </div>
  );
}
