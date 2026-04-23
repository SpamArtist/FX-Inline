DROP TABLE IF EXISTS oauth_identities;
DROP TABLE IF EXISTS oauth_states;

ALTER TABLE users DROP COLUMN password_hash;
