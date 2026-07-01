# Admin Guide

Administration and configuration guide for CollabAi.

---

## Admin Access

Admin features are available to users with the `admin` role.

### Granting Admin Access
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('user-uuid-here', 'admin');
```

Or via the Admin UI: **Admin → User Management → Edit User → Role**

---

## Admin Sections

| Section | Description |
|---------|-------------|
| [System Settings](./system-settings.md) | App configuration, branding |
| [User Management](./user-management.md) | Users, roles, invites |
| [Feature Flags](./feature-flags.md) | Enable/disable modules |
| [Integrations](./integrations-admin.md) | Configure external services |
| [AI Settings](./ai-settings.md) | AI provider configuration |
| [Analytics](./analytics.md) | Usage and activity logs |

---

## Files in This Section

| File | Description |
|------|-------------|
| [system-settings.md](./system-settings.md) | Branding, app name, etc. |
| [user-management.md](./user-management.md) | Managing users |
| [feature-flags.md](./feature-flags.md) | Module toggles |
| [integrations-admin.md](./integrations-admin.md) | Service configuration |
| [ai-settings.md](./ai-settings.md) | AI provider setup |
| [analytics.md](./analytics.md) | Reports and logs |
| [sso-setup.md](./sso-setup.md) | SSO configuration |

---

## Quick Admin Tasks

### Change App Branding
1. Go to **Admin → System Settings**
2. Update App Name, Logo URL, Colors
3. Click Save

### Invite a User
1. Go to **Admin → User Management**
2. Click **Invite User**
3. Enter email and select role
4. User receives invite email

### Enable a Feature
1. Go to **Admin → System Settings → Features**
2. Toggle the feature on
3. Feature is immediately available

### View Activity Logs
1. Go to **Admin → Activity Logs**
2. Filter by user, action, or date
3. Export if needed

---

## Role Hierarchy

| Role | Permissions |
|------|-------------|
| `admin` | Full access to all features and admin panel |
| `moderator` | Can manage content, limited admin access |
| `user` | Standard user access |

---

## Security Considerations

- Admin actions are logged in `activity_logs`
- Use strong passwords for admin accounts
- Consider enabling SSO for enterprise deployments
- Regularly review user access

---

## Related Sections

- [Deployment](../04-deployment/) - Production setup
- [Integrations](../05-integrations/) - External services
- [Architecture](../01-architecture/security.md) - Security model
