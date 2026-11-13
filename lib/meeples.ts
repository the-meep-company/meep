import { addDays, startOfDay } from 'date-fns';
import { supabase } from './supabase';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isBot, useMeepleStore, type MeepleDraft } from '@/stores/meepleStore';
import { chatWithBot } from './bots';
import type { ChatAction, MeepleMessage, MeepleSource } from '@/types';

/** Starting points offered when creating a meeple. Everything is editable afterwards. */
export const MEEPLE_TEMPLATES: (MeepleDraft & { blurb: string })[] = [
  {
    name: 'Scout',
    role: 'Web lookout',
    blurb: 'Keeps an eye out online for something you care about',
    instructions:
      'Keep a lookout online for: [what to watch for — e.g. price drops on a Fuji X100VI, new flats in Hackney under £1,800, tickets for a band]. Each time I check in, search for what is new since last time and tell me only what is worth my attention, with links.',
    icon: 'binoculars',
    glow: 'ocean',
    webSearch: true,
    scheduleAccess: false,
  },
  {
    name: 'Sage',
    role: 'Researcher',
    blurb: 'Digs into a question and comes back with a short answer',
    instructions:
      'Research whatever I ask and come back with a short, sourced answer I can act on. Lead with the conclusion, then the two or three facts that support it.',
    icon: 'search',
    glow: 'plum',
    webSearch: true,
    scheduleAccess: false,
  },
  {
    name: 'Penny',
    role: 'Inbox helper',
    blurb: 'Turns emails you paste in into replies and to-dos',
    instructions:
      "Help me stay on top of email. When I paste in an email or a thread, tell me in one line what it wants from me, draft a reply in my voice (short, friendly, direct), and propose a task for anything I need to follow up on.",
    icon: 'envelope-o',
    glow: 'apricot',
    webSearch: false,
    scheduleAccess: true,
  },
  {
    name: 'Atlas',
    role: 'Planner',
    blurb: 'Plans trips, projects and events around your calendar',
    instructions:
      'Help me plan things — trips, projects, events. Break what I give you into concrete steps, check them against my calendar, and propose the tasks and events that would make it happen.',
    icon: 'map-o',
    glow: 'lime',
    webSearch: true,
    scheduleAccess: true,
  },
];

export const MEEPLE_ICONS = [
  'binoculars', 'search', 'envelope-o', 'map-o', 'shopping-basket', 'plane',
  'heartbeat', 'book', 'money', 'home', 'music', 'lightbulb-o',
] as const;

export const CHECK_IN_TEXT = 'Check in: do a fresh pass of your brief and tell me what’s new.';

const newId = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);

function scheduleContext() {
  const today = startOfDay(new Date());
  const iso = (d: Date | string) => new Date(d).toISOString();
  return {
    events: useCalendarStore
      .getState()
      .getEventsForRange(today, addDays(today, 4))
      .map((e) => ({ title: e.title, startTime: iso(e.startTime), endTime: iso(e.endTime) })),
    tasks: useTaskStore
      .getState()
      .tasks.filter((t) => t.status !== 'done')
      .map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? iso(t.dueDate) : undefined,
      })),
  };
}

/**
 * Sends a message to a meeple and stores its reply. Runs against the store rather
 * than a screen, so the reply still lands (and marks the meeple unread) if the
 * user has left the thread.
 */
export async function sendToMeeple(meepleId: string, text: string): Promise<void> {
  const store = useMeepleStore.getState();
  const meeple = store.meeples.find((m) => m.id === meepleId);
  if (!meeple || store.workingIds.includes(meepleId)) return;

  const userMsg: MeepleMessage = { id: newId(), role: 'user', content: text, timestamp: new Date() };
  store.addMessage(meepleId, userMsg);
  store.setWorking(meepleId, true);

  // Bots answer through run-bot, which can also leave proposals in the feed and
  // saves its reply to the thread itself.
  if (isBot(meeple)) {
    try {
      const result = await chatWithBot(meepleId, text);
      if (result.replyMessageId && result.reply) {
        useMeepleStore.getState().applyRemoteMessage(meepleId, {
          id: result.replyMessageId,
          role: 'assistant',
          content: result.reply,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      useMeepleStore.getState().addMessage(meepleId, {
        id: newId(),
        role: 'assistant',
        content: `Sorry, I couldn't get to that. ${err instanceof Error ? err.message : 'Please try again.'}`,
        timestamp: new Date(),
      });
    } finally {
      useMeepleStore.getState().setWorking(meepleId, false);
    }
    return;
  }

  const { companionName, timezone } = useSettingsStore.getState();
  let reply: MeepleMessage;
  try {
    const { data, error } = await supabase.functions.invoke('meeple', {
      body: {
        meeple: {
          name: meeple.name,
          role: meeple.role,
          instructions: meeple.instructions,
          webSearch: meeple.webSearch,
          scheduleAccess: meeple.scheduleAccess,
        },
        messages: [...meeple.messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        companionName,
        timezone,
        currentDate: new Date().toISOString(),
        context: meeple.scheduleAccess ? scheduleContext() : undefined,
      },
    });
    if (error) throw error;
    const result = data as { message: string; actions?: ChatAction[] | null; sources?: MeepleSource[] };
    reply = {
      id: newId(),
      role: 'assistant',
      content: result.message,
      actions: result.actions ?? undefined,
      sources: result.sources?.length ? result.sources : undefined,
      timestamp: new Date(),
    };
  } catch (err) {
    reply = {
      id: newId(),
      role: 'assistant',
      content: `Sorry, I couldn't get to that. ${err instanceof Error ? err.message : 'Please try again.'}`,
      timestamp: new Date(),
    };
  }

  // The meeple may have been deleted while it was working.
  const after = useMeepleStore.getState();
  if (after.meeples.some((m) => m.id === meepleId)) after.addMessage(meepleId, reply);
  after.setWorking(meepleId, false);
}
