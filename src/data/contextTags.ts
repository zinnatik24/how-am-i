import { ContextTag } from '../types';

export const CONTEXT_TAGS: ContextTag[] = [
  // PEOPLE
  { id: 'alone', category: 'people', icon: 'person-outline', en: 'Alone', ru: 'Один' },
  { id: 'friends', category: 'people', icon: 'people-outline', en: 'Friends', ru: 'Друзья' },
  { id: 'partner', category: 'people', icon: 'heart-outline', en: 'Partner', ru: 'Партнёр' },
  { id: 'family', category: 'people', icon: 'home-outline', en: 'Family', ru: 'Семья' },
  { id: 'coworkers', category: 'people', icon: 'briefcase-outline', en: 'Coworkers', ru: 'Коллеги' },
  { id: 'strangers', category: 'people', icon: 'globe-outline', en: 'Strangers', ru: 'Незнакомцы' },

  // LOCATION
  { id: 'home', category: 'location', icon: 'bed-outline', en: 'Home', ru: 'Дом' },
  { id: 'work', category: 'location', icon: 'business-outline', en: 'Work', ru: 'Работа' },
  { id: 'commute', category: 'location', icon: 'car-outline', en: 'Commute', ru: 'В дороге' },
  { id: 'outdoors', category: 'location', icon: 'leaf-outline', en: 'Outdoors', ru: 'На улице' },
  { id: 'gym', category: 'location', icon: 'fitness-outline', en: 'Gym', ru: 'Спортзал' },
  { id: 'cafe', category: 'location', icon: 'cafe-outline', en: 'Cafe', ru: 'Кафе' },

  // ACTIVITY
  { id: 'working', category: 'activity', icon: 'laptop-outline', en: 'Working', ru: 'Работа' },
  { id: 'resting', category: 'activity', icon: 'moon-outline', en: 'Resting', ru: 'Отдых' },
  { id: 'socializing', category: 'activity', icon: 'chatbubbles-outline', en: 'Socializing', ru: 'Общение' },
  { id: 'exercising', category: 'activity', icon: 'barbell-outline', en: 'Exercising', ru: 'Тренировка' },
  { id: 'eating', category: 'activity', icon: 'restaurant-outline', en: 'Eating', ru: 'Еда' },
  { id: 'chores', category: 'activity', icon: 'sparkles-outline', en: 'Chores', ru: 'Быт и дела' },
  { id: 'hobby', category: 'activity', icon: 'color-palette-outline', en: 'Hobby', ru: 'Хобби' },
  { id: 'learning', category: 'activity', icon: 'book-outline', en: 'Learning', ru: 'Учёба' },
];
