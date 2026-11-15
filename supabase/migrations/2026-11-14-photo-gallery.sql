-- Run once in Supabase > SQL Editor on a database created before the photo gallery was added.
alter table cards add column if not exists photos text[] not null default '{}';
update cards set photos = array_remove(array[image_url, image_back_url], null) where photos = '{}' and image_url is not null;
