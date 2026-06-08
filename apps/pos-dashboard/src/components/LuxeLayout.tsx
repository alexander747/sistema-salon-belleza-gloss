import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CalendarMonth,
  Group,
  ContentCut,
  Badge as BadgeIcon,
  Inventory2,
  ShoppingCart,
  AttachMoney,
  AddCircle,
  Settings,
  Logout,
  Notifications,
  DarkMode,
  LightMode,
  Category,
  AccountBalanceWallet,
  ChevronLeft,
  ChevronRight,
  AccessTime,
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';

const DRAWER_WIDTH_EXPANDED = 260;
const DRAWER_WIDTH_COLLAPSED = 72;

interface SalonInfo {
  id: number;
  nombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  tema: string | null;
}

interface LuxeLayoutProps {
  user?: {
    nombre?: string;
    salon?: SalonInfo | null;
  } | null;
  onLogout: () => void;
  loading?: boolean;
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: <DashboardIcon /> },
  { label: 'Citas', href: '/agenda', icon: <CalendarMonth /> },
  { label: 'Clientes', href: '/clientes', icon: <Group /> },
  { label: 'Servicios', href: '/servicios', icon: <ContentCut /> },
  { label: 'Empleadas', href: '/empleadas', icon: <BadgeIcon /> },
  { label: 'Productos', href: '/productos', icon: <Inventory2 /> },
  { label: 'Categorías', href: '/categorias', icon: <Category /> },
  { label: 'Ventas', href: '/ventas', icon: <ShoppingCart /> },
  { label: 'Finanzas', href: '/finanzas', icon: <AttachMoney /> },
  { label: 'Préstamos', href: '/prestamos', icon: <AccountBalanceWallet /> },
  { label: 'Horarios', href: '/horarios', icon: <AccessTime /> },
];

const LuxeLayout: React.FC<LuxeLayoutProps> = ({ user, onLogout, loading }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useThemeMode();

  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored === 'true';
  });

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;
  const salonName = user?.salon?.nombre;

  /* ── Dynamic document title ── */
  useEffect(() => {
    document.title = salonName ? `${salonName} | Dashboard` : 'Dashboard';
  }, [salonName]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const getPageTitle = () => {
    const item = NAV_ITEMS.find((i) => i.href === location.pathname);
    return item ? item.label : 'Dashboard';
  };

  /* ── Helper to render a nav link with optional tooltip ── */
  const renderNavButton = (
    href: string,
    icon: React.ReactNode,
    label: string,
    extraSx?: Record<string, unknown>,
    extraIconSx?: Record<string, unknown>,
  ) => {
    const isActive = location.pathname === href;
    const button = (
      <ListItemButton
        onClick={() => navigate(href)}
        sx={{
          borderRadius: 3,
          mb: 0.5,
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 1 : 2,
          minHeight: 44,
          bgcolor: isActive ? 'primary.main' : 'transparent',
          color: isActive ? '#000' : 'text.secondary',
          '&:hover': {
            bgcolor: isActive ? 'primary.dark' : 'action.hover',
          },
          ...extraSx,
        }}
      >
        <ListItemIcon
          sx={{
            color: isActive ? '#000' : 'text.secondary',
            minWidth: collapsed ? 0 : 40,
            justifyContent: 'center',
            ...extraIconSx,
          }}
        >
          {icon}
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={label}
            slotProps={{
              primary: {
                sx: {
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                },
              },
            }}
          />
        )}
      </ListItemButton>
    );

    if (collapsed) {
      return (
        <Tooltip title={label} placement="right" arrow>
          {button}
        </Tooltip>
      );
    }
    return button;
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ── Sidebar ── */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          transition: 'width 0.3s ease',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowX: 'hidden',
            transition: 'width 0.3s ease',
          },
        }}
      >
        {/* Logo / Salon name */}
        <Box
          sx={{
            p: collapsed ? 1.5 : 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 1,
            minHeight: 64,
          }}
        >
          {collapsed ? (
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Playfair Display", serif',
                color: 'primary.main',
                fontWeight: 700,
              }}
            >
              {salonName?.charAt(0)?.toUpperCase() || 'S'}
            </Typography>
          ) : (
            <>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  color: 'primary.main',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 160,
                }}
              >
                {salonName || 'Sistema'}
              </Typography>

            </>
          )}
        </Box>
        <Divider />

        {/* Navigation */}
        <List sx={{ flex: 1, px: collapsed ? 0.5 : 1.5, pt: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItem key={item.href} disablePadding>
              {renderNavButton(item.href, item.icon, item.label)}
            </ListItem>
          ))}
        </List>

        <Divider />

        {/* New Appointment CTA */}
        <Box sx={{ p: collapsed ? 1 : 2, display: 'flex', justifyContent: 'center' }}>
          {collapsed ? (
            <Tooltip title="Nueva Cita" placement="right" arrow>
              <IconButton
                onClick={() => navigate('/agenda')}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#000',
                  borderRadius: 2,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <AddCircle />
              </IconButton>
            </Tooltip>
          ) : (
            <ListItemButton
              onClick={() => navigate('/agenda')}
              sx={{
                borderRadius: 3,
                bgcolor: 'primary.main',
                color: '#000',
                justifyContent: 'center',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <AddCircle sx={{ mr: 1 }} />
              <ListItemText
                primary="Nueva Cita"
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
            </ListItemButton>
          )}
        </Box>

        {/* Bottom actions */}
        <List sx={{ px: collapsed ? 0.5 : 1.5 }}>
          <ListItem disablePadding>
            <Tooltip title="Configuración" placement="right" arrow disableHoverListener={!collapsed}>
              <ListItemButton
                onClick={() => {}}
                sx={{
                  borderRadius: 3,
                  mb: 0.5,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 1 : 2,
                  minHeight: 44,
                  color: 'text.secondary',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 40,
                    justifyContent: 'center',
                    color: 'text.secondary',
                  }}
                >
                  <Settings />
                </ListItemIcon>
                {!collapsed && <ListItemText primary="Configuración" />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
          <ListItem disablePadding>
            <Tooltip title="Cerrar sesión" placement="right" arrow disableHoverListener={!collapsed}>
              <ListItemButton
                onClick={onLogout}
                sx={{
                  borderRadius: 3,
                  color: 'error.main',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 1 : 2,
                  minHeight: 44,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 40,
                    justifyContent: 'center',
                    color: 'error.main',
                  }}
                >
                  <Logout />
                </ListItemIcon>
                {!collapsed && <ListItemText primary="Cerrar sesión" />}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        </List>
      </Drawer>

      {/* ── Main content ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            {/* Sidebar toggle */}
            <IconButton onClick={toggleSidebar} sx={{ mr: 1 }} size="small">
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>

            <Typography
              variant="h1"
              sx={{ fontSize: '1.5rem', fontWeight: 700, flex: 1 }}
            >
              {getPageTitle()}
            </Typography>

            {/* Salon name badge in header */}
            {salonName && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}
              >
                {salonName}
              </Typography>
            )}

            <IconButton>
              <Notifications />
            </IconButton>
            <IconButton onClick={toggleColorMode}>
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {user?.nombre || 'Dueña'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Dueña
                </Typography>
              </Box>
              <Avatar
                sx={{ bgcolor: 'primary.main', color: '#000', fontWeight: 700 }}
              >
                {user?.nombre?.charAt(0)?.toUpperCase() || 'D'}
              </Avatar>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ p: 3, flex: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default LuxeLayout;
