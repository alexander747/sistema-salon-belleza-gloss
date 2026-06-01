import React from 'react';
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
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';

const DRAWER_WIDTH = 260;

interface LuxeLayoutProps {
  userName?: string;
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
];

const LuxeLayout: React.FC<LuxeLayoutProps> = ({ userName, onLogout, loading }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useThemeMode();

  const getPageTitle = () => {
    const item = NAV_ITEMS.find((i) => i.href === location.pathname);
    return item ? item.label : 'Dashboard';
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
        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {/* Logo */}
          <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Playfair Display", serif',
                color: 'primary.main',
                fontWeight: 700,
              }}
            >
              Luxe
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 300, color: 'text.primary' }}>
              Aura
            </Typography>
          </Box>
          <Divider />

          {/* Navigation */}
          <List sx={{ flex: 1, px: 1.5, pt: 1 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <ListItem key={item.href} disablePadding>
                  <ListItemButton
                    onClick={() => navigate(item.href)}
                    sx={{
                      borderRadius: 3,
                      mb: 0.5,
                      bgcolor: isActive ? 'primary.main' : 'transparent',
                      color: isActive ? '#000' : 'text.secondary',
                      '&:hover': {
                        bgcolor: isActive ? 'primary.dark' : 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActive ? '#000' : 'text.secondary',
                        minWidth: 40,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          sx: {
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 600 : 400,
                          },
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          <Divider />

          {/* New Appointment CTA */}
          <Box sx={{ p: 2 }}>
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
          </Box>

          {/* Bottom actions */}
          <List sx={{ px: 1.5 }}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => {}} sx={{ borderRadius: 3, mb: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Settings />
                </ListItemIcon>
                <ListItemText primary="Configuración" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={onLogout}
                sx={{ borderRadius: 3, color: 'error.main' }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}>
                  <Logout />
                </ListItemIcon>
                <ListItemText primary="Cerrar sesión" />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>

        {/* Main content */}
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
              <Typography
                variant="h1"
                sx={{ fontSize: '1.5rem', fontWeight: 700, flex: 1 }}
              >
                {getPageTitle()}
              </Typography>
              <IconButton>
                <Notifications />
              </IconButton>
              <IconButton
                onClick={toggleColorMode}
              >
                {mode === 'dark' ? <LightMode /> : <DarkMode />}
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {userName || 'Dueña'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Dueña
                  </Typography>
                </Box>
                <Avatar
                  sx={{ bgcolor: 'primary.main', color: '#000', fontWeight: 700 }}
                >
                  {userName?.charAt(0)?.toUpperCase() || 'D'}
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
